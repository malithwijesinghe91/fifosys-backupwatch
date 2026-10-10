import { TableClient } from "@azure/data-tables";
import { getTableClient } from "./tableService";

export interface IAutotaskRoutingConfig {
    queueId?: number;
    queueName?: string;
    priorityId?: number;
    categoryId?: number;
    workTypeId?: number;
    issueTypeId?: number;
    subIssueTypeId?: number;
    updatedBy?: string;
    updatedTime?: string;
}

let cachedRoutingConfig: IAutotaskRoutingConfig | null = null;
let lastFetchTime = 0;
const ROUTING_CACHE_TTL = 60 * 1000; // 1 minute local cache

export async function getAutotaskRoutingConfig(): Promise<IAutotaskRoutingConfig> {
    const now = Date.now();
    if (cachedRoutingConfig && (now - lastFetchTime < ROUTING_CACHE_TTL)) {
        return cachedRoutingConfig;
    }

    const fallback: IAutotaskRoutingConfig = {
        queueId: process.env.AUTOTASK_QUEUE_ID ? parseInt(process.env.AUTOTASK_QUEUE_ID, 10) : undefined,
        categoryId: process.env.AUTOTASK_CATEGORY_ID ? parseInt(process.env.AUTOTASK_CATEGORY_ID, 10) : undefined,
        priorityId: 2, // Medium default
        workTypeId: process.env.AUTOTASK_WORK_TYPE_ID ? parseInt(process.env.AUTOTASK_WORK_TYPE_ID, 10) : undefined,
        issueTypeId: process.env.AUTOTASK_ISSUE_TYPE_ID ? parseInt(process.env.AUTOTASK_ISSUE_TYPE_ID, 10) : undefined,
        subIssueTypeId: process.env.AUTOTASK_SUB_ISSUE_TYPE_ID ? parseInt(process.env.AUTOTASK_SUB_ISSUE_TYPE_ID, 10) : undefined
    };

    try {
        const tableClient = await getTableClient("SystemConfig");
        const entity = await tableClient.getEntity<any>("Autotask", "Routing");
        if (entity) {
            cachedRoutingConfig = {
                queueId: entity.queueId !== undefined ? Number(entity.queueId) : fallback.queueId,
                queueName: entity.queueName ? String(entity.queueName) : undefined,
                priorityId: entity.priorityId !== undefined ? Number(entity.priorityId) : fallback.priorityId,
                categoryId: entity.categoryId !== undefined ? Number(entity.categoryId) : fallback.categoryId,
                workTypeId: entity.workTypeId !== undefined ? Number(entity.workTypeId) : fallback.workTypeId,
                issueTypeId: entity.issueTypeId !== undefined ? Number(entity.issueTypeId) : fallback.issueTypeId,
                subIssueTypeId: entity.subIssueTypeId !== undefined ? Number(entity.subIssueTypeId) : fallback.subIssueTypeId,
                updatedBy: entity.updatedBy,
                updatedTime: entity.updatedTime
            };
            lastFetchTime = now;
            return cachedRoutingConfig;
        }
    } catch (err: any) {
        // 404 is expected if not configured yet
    }

    cachedRoutingConfig = fallback;
    lastFetchTime = now;
    return cachedRoutingConfig;
}

export async function saveAutotaskRoutingConfig(config: IAutotaskRoutingConfig, userEmail: string): Promise<void> {
    const tableClient = await getTableClient("SystemConfig");
    const entity = {
        partitionKey: "Autotask",
        rowKey: "Routing",
        queueId: config.queueId,
        queueName: config.queueName || "",
        priorityId: config.priorityId || 2,
        categoryId: config.categoryId,
        workTypeId: config.workTypeId,
        issueTypeId: config.issueTypeId,
        subIssueTypeId: config.subIssueTypeId,
        updatedBy: userEmail,
        updatedTime: new Date().toISOString()
    };

    await tableClient.upsertEntity(entity, "Replace");
    cachedRoutingConfig = {
        ...config,
        updatedBy: userEmail,
        updatedTime: entity.updatedTime
    };
    lastFetchTime = Date.now();
}

export interface IGlobalMaintenanceConfig {
    isActive: boolean;
    expiresAt?: string | null;
    durationHours?: number;
    reason?: string;
    activatedBy?: string;
    activatedTime?: string;
}

let cachedMaintenanceConfig: IGlobalMaintenanceConfig | null = null;
let lastMaintenanceFetchTime = 0;
const MAINTENANCE_CACHE_TTL = 30 * 1000; // 30 second local cache

export async function getGlobalMaintenanceMode(): Promise<IGlobalMaintenanceConfig> {
    const now = Date.now();
    if (cachedMaintenanceConfig && (now - lastMaintenanceFetchTime < MAINTENANCE_CACHE_TTL)) {
        // Auto-expire if past expiresAt
        if (cachedMaintenanceConfig.isActive && cachedMaintenanceConfig.expiresAt) {
            if (now >= new Date(cachedMaintenanceConfig.expiresAt).getTime()) {
                cachedMaintenanceConfig.isActive = false;
            }
        }
        return cachedMaintenanceConfig;
    }

    try {
        const tableClient = await getTableClient("SystemConfig");
        const entity = await tableClient.getEntity<any>("Global", "MaintenanceMode");
        if (entity) {
            let active = Boolean(entity.isActive);
            if (active && entity.expiresAt && now >= new Date(entity.expiresAt).getTime()) {
                active = false;
            }
            cachedMaintenanceConfig = {
                isActive: active,
                expiresAt: entity.expiresAt || null,
                durationHours: entity.durationHours !== undefined ? Number(entity.durationHours) : 0,
                reason: entity.reason || "",
                activatedBy: entity.activatedBy || "",
                activatedTime: entity.activatedTime || ""
            };
            lastMaintenanceFetchTime = now;
            return cachedMaintenanceConfig;
        }
    } catch {
        // Not configured yet
    }

    cachedMaintenanceConfig = { isActive: false };
    lastMaintenanceFetchTime = now;
    return cachedMaintenanceConfig;
}

export async function setGlobalMaintenanceMode(config: IGlobalMaintenanceConfig, userEmail: string): Promise<void> {
    const tableClient = await getTableClient("SystemConfig");
    const entity = {
        partitionKey: "Global",
        rowKey: "MaintenanceMode",
        isActive: Boolean(config.isActive),
        expiresAt: config.expiresAt || "",
        durationHours: config.durationHours || 0,
        reason: config.reason || "",
        activatedBy: userEmail,
        activatedTime: new Date().toISOString()
    };

    await tableClient.upsertEntity(entity, "Replace");
    cachedMaintenanceConfig = {
        ...config,
        activatedBy: userEmail,
        activatedTime: entity.activatedTime
    };
    lastMaintenanceFetchTime = Date.now();
}

export interface IAlertRoutingConfig {
    alertKey: string;
    label: string;
    autoTicketEnabled: boolean;
    queueId: number;
    priorityId: number;
    categoryId?: number;
    workTypeId?: number;
    issueTypeId?: number;
    subIssueTypeId?: number;
    titleTemplate: string;
    updatedBy?: string;
    updatedTime?: string;
}

export const DEFAULT_ALERT_ROUTING_MATRIX: Record<string, IAlertRoutingConfig> = {
    VolumeExclusion: {
        alertKey: "VolumeExclusion",
        label: "Volume Exclusions",
        autoTicketEnabled: true, // Currently ACTIVE in production
        queueId: 29683488, // Backup
        priorityId: 2, // Medium
        categoryId: 115, // Other Backup Alert
        workTypeId: 29682804,
        issueTypeId: 30, // Backup
        subIssueTypeId: 289, // Warning
        titleTemplate: "Volume Exclusion Detected - {Device} - {Agent} - {Detail}"
    },
    StorageAlert: {
        alertKey: "StorageAlert",
        label: "Storage Alerts",
        autoTicketEnabled: false, // Monitored only by default
        queueId: 29683488, // Backup
        priorityId: 2, // Medium
        categoryId: 115, // Other Backup Alert
        workTypeId: 29682804,
        issueTypeId: 30, // Backup
        subIssueTypeId: 289, // Warning
        titleTemplate: "[{Company}] Storage Warning: {Device} at {Detail} Capacity"
    },
    LocalBackupFailure: {
        alertKey: "LocalBackupFailure",
        label: "Local Backup Failures",
        autoTicketEnabled: false, // Monitored only by default
        queueId: 29683488, // Backup
        priorityId: 1, // High
        categoryId: 115, // Other Backup Alert
        workTypeId: 29682804,
        issueTypeId: 30, // Backup
        subIssueTypeId: 290, // Failure
        titleTemplate: "[{Company}] Backup Failure: {Agent} on {Device}"
    },
    OverdueBackup: {
        alertKey: "OverdueBackup",
        label: "Overdue Backups",
        autoTicketEnabled: false, // Monitored only by default
        queueId: 29683488, // Backup
        priorityId: 2, // Medium
        categoryId: 115, // Other Backup Alert
        workTypeId: 29682804,
        issueTypeId: 30, // Backup
        subIssueTypeId: 289, // Warning
        titleTemplate: "[{Company}] Backup Overdue: {Agent} ({Detail})"
    },
    OffsiteSyncIssue: {
        alertKey: "OffsiteSyncIssue",
        label: "Offsite Sync Issues",
        autoTicketEnabled: false, // Monitored only by default
        queueId: 29683489, // Backup - IRM
        priorityId: 2, // Medium
        categoryId: 115, // Other Backup Alert
        workTypeId: 29682804,
        issueTypeId: 30, // Backup
        subIssueTypeId: 289, // Warning
        titleTemplate: "[{Company}] Cloud Replication Stalled - {Device} ({Detail})"
    },
    ScreenshotFailure: {
        alertKey: "ScreenshotFailure",
        label: "Screenshot Failures",
        autoTicketEnabled: false, // Monitored only by default
        queueId: 29683488, // Backup
        priorityId: 2, // Medium
        categoryId: 115, // Other Backup Alert
        workTypeId: 29682804,
        issueTypeId: 30, // Backup
        subIssueTypeId: 290, // Failure
        titleTemplate: "[{Company}] Screenshot Boot Failure - {Agent}"
    },
    OfflineAppliance: {
        alertKey: "OfflineAppliance",
        label: "Offline Appliances",
        autoTicketEnabled: false, // Monitored only by default
        queueId: 29682969, // Tier 2 Support
        priorityId: 4, // Critical
        categoryId: 115, // Other Backup Alert
        workTypeId: 29682804,
        issueTypeId: 24, // Availability
        subIssueTypeId: 268, // Device Offline
        titleTemplate: "[{Company}] URGENT: Appliance Offline - {Device}"
    }
};

let cachedAlertMatrix: Record<string, IAlertRoutingConfig> | null = null;
let lastMatrixFetchTime = 0;
const MATRIX_CACHE_TTL = 30 * 1000; // 30-sec cache

export async function getAlertRoutingMatrix(): Promise<Record<string, IAlertRoutingConfig>> {
    const now = Date.now();
    if (cachedAlertMatrix && (now - lastMatrixFetchTime < MATRIX_CACHE_TTL)) {
        return cachedAlertMatrix;
    }

    const matrix: Record<string, IAlertRoutingConfig> = JSON.parse(JSON.stringify(DEFAULT_ALERT_ROUTING_MATRIX));

    try {
        const tableClient = await getTableClient("SystemConfig");
        const entities = tableClient.listEntities<any>({
            queryOptions: { filter: "PartitionKey eq 'AlertRouting'" }
        });

        for await (const entity of entities) {
            const key = entity.rowKey;
            if (matrix[key]) {
                matrix[key] = {
                    ...matrix[key],
                    autoTicketEnabled: entity.autoTicketEnabled !== undefined ? Boolean(entity.autoTicketEnabled) : matrix[key].autoTicketEnabled,
                    queueId: entity.queueId ? Number(entity.queueId) : matrix[key].queueId,
                    priorityId: entity.priorityId ? Number(entity.priorityId) : matrix[key].priorityId,
                    categoryId: entity.categoryId ? Number(entity.categoryId) : matrix[key].categoryId,
                    workTypeId: entity.workTypeId ? Number(entity.workTypeId) : matrix[key].workTypeId,
                    issueTypeId: entity.issueTypeId ? Number(entity.issueTypeId) : matrix[key].issueTypeId,
                    subIssueTypeId: entity.subIssueTypeId ? Number(entity.subIssueTypeId) : matrix[key].subIssueTypeId,
                    titleTemplate: entity.titleTemplate || matrix[key].titleTemplate,
                    updatedBy: entity.updatedBy || "",
                    updatedTime: entity.updatedTime || ""
                };
            }
        }
    } catch {
        // Return default matrix if not configured
    }

    cachedAlertMatrix = matrix;
    lastMatrixFetchTime = now;
    return matrix;
}

export async function saveAlertRoutingMatrix(updates: Record<string, Partial<IAlertRoutingConfig>>, userEmail: string): Promise<void> {
    const tableClient = await getTableClient("SystemConfig");
    const currentMatrix = await getAlertRoutingMatrix();

    for (const [key, config] of Object.entries(updates)) {
        if (!DEFAULT_ALERT_ROUTING_MATRIX[key]) continue;

        const merged: IAlertRoutingConfig = {
            ...currentMatrix[key],
            ...config,
            updatedBy: userEmail,
            updatedTime: new Date().toISOString()
        };

        const entity = {
            partitionKey: "AlertRouting",
            rowKey: key,
            autoTicketEnabled: Boolean(merged.autoTicketEnabled),
            queueId: merged.queueId,
            priorityId: merged.priorityId,
            categoryId: merged.categoryId || 115,
            workTypeId: merged.workTypeId || 29682804,
            issueTypeId: merged.issueTypeId || 0,
            subIssueTypeId: merged.subIssueTypeId || 0,
            titleTemplate: merged.titleTemplate || "",
            updatedBy: userEmail,
            updatedTime: merged.updatedTime
        };

        await tableClient.upsertEntity(entity, "Replace");
        currentMatrix[key] = merged;
    }

    cachedAlertMatrix = currentMatrix;
    lastMatrixFetchTime = Date.now();
}


