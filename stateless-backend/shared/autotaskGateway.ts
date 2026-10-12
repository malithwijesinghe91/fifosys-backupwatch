/**
 * Autotask gateway (BW-004) – the ONLY place that sends HTTP requests to Autotask.
 *
 * - Concurrency: at most AUTOTASK_MAX_CONCURRENT request(s) in flight per instance. The Function
 *   App is capped at 2 instances (D-04), so 1 per instance keeps the whole app at <= 2, under
 *   Autotask's 3-thread limit.
 * - Priority: requests made inside runAsUserAction() (engineer actions) jump ahead of background
 *   scanner requests. Within a priority, requests run in arrival order.
 * - Retries: "busy" responses (HTTP 429 / "thread threshold") are retried after 1 s, 2 s, 4 s.
 *   Reads are also retried on network errors and 5xx; writes are not (a 5xx write may already
 *   have created the ticket, so retrying could duplicate it).
 * - Queue wait cap: a request that cannot start within MAX_QUEUE_WAIT_MS fails cleanly.
 * - Every call is logged (method, path without query string, status, wait and duration).
 *   Credentials and query strings are never logged.
 *
 * Silence / change-freeze rules for writes live in autotaskPolicy.ts and are applied by the
 * write functions in autotask.ts before they reach this gateway.
 */
import axios from "axios";
import { AsyncLocalStorage } from "async_hooks";

export interface IAutotaskCredentials {
    user: string;
    secret: string;
    integrationCode: string;
}

export type AutotaskPriority = "user" | "background";
export type AutotaskMethod = "get" | "post" | "patch";

export interface IAutotaskRequest {
    method: AutotaskMethod;
    url: string;
    data?: any;
    timeoutMs?: number;
    /** Writes (create/update) are never retried on 5xx or network errors. */
    kind: "read" | "write";
    /** Send without Autotask credential headers (zoneInformation lookup). */
    anonymous?: boolean;
}

export const AUTOTASK_MAX_CONCURRENT = 1;

const timing = {
    retryDelaysMs: [1000, 2000, 4000],
    maxQueueWaitMs: 60 * 1000
};

const priorityStore = new AsyncLocalStorage<AutotaskPriority>();

/** Runs fn with user priority: its Autotask requests are served before background ones. */
export function runAsUserAction<T>(fn: () => Promise<T>): Promise<T> {
    return priorityStore.run("user", fn);
}

export function currentAutotaskPriority(): AutotaskPriority {
    return priorityStore.getStore() || "background";
}

export class AutotaskQueueTimeoutError extends Error {
    constructor(waitedMs: number) {
        super(`Autotask request waited ${Math.round(waitedMs / 1000)}s in the gateway queue without starting; giving up.`);
        this.name = "AutotaskQueueTimeoutError";
    }
}

interface IQueued {
    enqueuedAt: number;
    start: () => void;
    timer: NodeJS.Timeout;
}

const queues: Record<AutotaskPriority, IQueued[]> = { user: [], background: [] };
let inFlight = 0;
const stats = { started: 0, peakInFlight: 0, retries: 0, queueTimeouts: 0 };

function dequeueNext(): IQueued | undefined {
    return queues.user.shift() || queues.background.shift();
}

function acquireSlot(priority: AutotaskPriority): Promise<number> {
    const enqueuedAt = Date.now();
    if (inFlight < AUTOTASK_MAX_CONCURRENT && queues.user.length === 0 && queues.background.length === 0) {
        inFlight++;
        stats.peakInFlight = Math.max(stats.peakInFlight, inFlight);
        return Promise.resolve(0);
    }
    return new Promise<number>((resolve, reject) => {
        const entry: IQueued = {
            enqueuedAt,
            start: () => {
                clearTimeout(entry.timer);
                resolve(Date.now() - enqueuedAt);
            },
            timer: setTimeout(() => {
                const list = queues[priority];
                const idx = list.indexOf(entry);
                if (idx > -1) list.splice(idx, 1);
                stats.queueTimeouts++;
                reject(new AutotaskQueueTimeoutError(Date.now() - enqueuedAt));
            }, timing.maxQueueWaitMs)
        };
        queues[priority].push(entry);
    });
}

function releaseSlot(): void {
    const next = dequeueNext();
    if (next) {
        // Hand the slot straight to the next request; inFlight stays the same.
        stats.peakInFlight = Math.max(stats.peakInFlight, inFlight);
        next.start();
    } else {
        inFlight--;
    }
}

function isBusyResponse(err: any): boolean {
    const status = err && err.response && err.response.status;
    if (status === 429) return true;
    const body = err && err.response && err.response.data;
    const text = `${typeof body === "string" ? body : JSON.stringify(body || "")} ${(err && err.message) || ""}`;
    return /thread threshold/i.test(text);
}

function isRetryable(err: any, kind: "read" | "write"): boolean {
    if (isBusyResponse(err)) return true;
    if (kind === "write") return false;
    const status = err && err.response && err.response.status;
    if (status === undefined) return true; // network error / timeout
    return status >= 500;
}

function logPath(url: string): string {
    // Path only: drops the host and query string (zoneInformation carries the API username).
    try {
        return new URL(url).pathname;
    } catch {
        return url.split("?")[0];
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function buildHeaders(config: IAutotaskCredentials | null): Record<string, string> {
    if (!config) return {};
    return {
        "UserName": config.user,
        "Secret": config.secret,
        "ApiIntegrationCode": config.integrationCode,
        "Content-Type": "application/json"
    };
}

async function send(config: IAutotaskCredentials | null, req: IAutotaskRequest): Promise<any> {
    const options: any = { timeout: req.timeoutMs || 15000 };
    const headers = buildHeaders(req.anonymous ? null : config);
    if (Object.keys(headers).length > 0) options.headers = headers;

    if (req.method === "get") return axios.get(req.url, options);
    if (req.method === "post") return axios.post(req.url, req.data, options);
    return axios.patch(req.url, req.data, options);
}

/**
 * Sends one Autotask request through the queue. Resolves with the axios response or rejects
 * with the last error (or AutotaskQueueTimeoutError). Callers keep their existing error handling.
 */
export async function autotaskRequest(config: IAutotaskCredentials | null, req: IAutotaskRequest): Promise<any> {
    const priority = currentAutotaskPriority();
    const waitedMs = await acquireSlot(priority);
    const path = logPath(req.url);
    const started = Date.now();
    stats.started++;
    try {
        for (let attempt = 0; ; attempt++) {
            try {
                const response = await send(config, req);
                console.log(`[Autotask Gateway] ${req.method.toUpperCase()} ${path} -> ${response && response.status} (priority=${priority}, waited=${waitedMs}ms, took=${Date.now() - started}ms, attempt=${attempt + 1})`);
                return response;
            } catch (err: any) {
                const status = err && err.response && err.response.status;
                if (attempt < timing.retryDelaysMs.length && isRetryable(err, req.kind)) {
                    const delay = timing.retryDelaysMs[attempt];
                    stats.retries++;
                    console.warn(`[Autotask Gateway] ${req.method.toUpperCase()} ${path} -> ${status || "network error"}; retrying in ${delay}ms (attempt ${attempt + 1} of ${timing.retryDelaysMs.length + 1})`);
                    await sleep(delay);
                    continue;
                }
                console.error(`[Autotask Gateway] ${req.method.toUpperCase()} ${path} -> ${status || "network error"} after ${attempt + 1} attempt(s) (priority=${priority}, waited=${waitedMs}ms, took=${Date.now() - started}ms)`);
                throw err;
            }
        }
    } finally {
        releaseSlot();
    }
}

export function getAutotaskGatewayStats() {
    return {
        ...stats,
        inFlight,
        queuedUser: queues.user.length,
        queuedBackground: queues.background.length,
        maxConcurrent: AUTOTASK_MAX_CONCURRENT
    };
}

/** Test hook: shorten retry delays / queue wait and reset counters. Not used by production code. */
export function __configureAutotaskGatewayForTests(opts: { retryDelaysMs?: number[]; maxQueueWaitMs?: number; resetStats?: boolean }): void {
    if (opts.retryDelaysMs) timing.retryDelaysMs = opts.retryDelaysMs;
    if (opts.maxQueueWaitMs !== undefined) timing.maxQueueWaitMs = opts.maxQueueWaitMs;
    if (opts.resetStats) {
        stats.started = 0;
        stats.peakInFlight = 0;
        stats.retries = 0;
        stats.queueTimeouts = 0;
    }
}
