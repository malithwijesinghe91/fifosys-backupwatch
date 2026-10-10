/**
 * Utility functions for normalizing volume names and evaluating exclusion/mute status.
 */

export interface IExclusionEntityLike {
    type: "Device" | "Agent" | "Volume";
    target: string;
    reason?: string;
    isPermanent?: boolean;
    expiresAt?: string | null;
    ticketNumber?: string | null;
    ticketUrl?: string | null;
    createdTime?: string;
    [key: string]: any;
}

/**
 * Normalizes volume identifiers (Windows drive letters, mount points, Linux paths).
 * Examples:
 * - "F:\" -> "F"
 * - "F:" -> "F"
 * - "f" -> "F"
 * - "C:\Data\" -> "C:/Data"
 * - "/var/log/" -> "/var/log"
 */
export function normalizeVolumeName(volumeName: string): string {
    if (!volumeName) return "";
    let clean = volumeName.trim().replace(/\\/g, "/");
    // Strip trailing slashes
    clean = clean.replace(/\/+$/, "");
    // If it's a single drive letter like "C:" or "F:", strip colon to normalize to "F"
    if (/^[a-zA-Z]:$/.test(clean)) {
        clean = clean.charAt(0);
    }
    return clean.toUpperCase();
}

/**
 * Builds a canonical lowercased target key for volume comparison.
 * e.g. "fif-datto-01:fif-dc-02:f"
 */
export function buildVolumeTargetKey(deviceName: string, agentName: string, volumeName: string): string {
    const dev = (deviceName || "").trim().toLowerCase();
    const agt = (agentName || "").trim().toLowerCase();
    const vol = normalizeVolumeName(volumeName).toLowerCase();
    return `${dev}:${agt}:${vol}`;
}

/**
 * Checks if a specific device/appliance is silenced (type === "Device").
 */
export function isDeviceSilenced<T extends IExclusionEntityLike>(
    exclusions: T[],
    deviceName: string
): boolean {
    if (!deviceName) return false;
    const dev = deviceName.trim().toLowerCase();
    return exclusions.some(
        e => e.type === "Device" && (e.target || "").trim().toLowerCase() === dev
    );
}

/**
 * Backward compatibility alias for isDeviceSilenced.
 */
export function isDeviceMuted<T extends IExclusionEntityLike>(
    exclusions: T[],
    deviceName: string
): T | undefined {
    if (!deviceName) return undefined;
    const dev = deviceName.trim().toLowerCase();
    return exclusions.find(
        e => e.type === "Device" && (e.target || "").trim().toLowerCase() === dev
    );
}

/**
 * Checks if an agent is silenced (type === "Agent" OR parent device silenced).
 */
export function isAgentSilenced<T extends IExclusionEntityLike>(
    exclusions: T[],
    deviceName: string,
    agentName: string
): boolean {
    if (!deviceName || !agentName) return false;
    if (isDeviceSilenced(exclusions, deviceName)) return true;

    const dev = deviceName.trim().toLowerCase();
    const agt = agentName.trim().toLowerCase();
    const targetKey = `${dev}:${agt}`;

    return exclusions.some(e => {
        if (e.type !== "Agent" || !e.target) return false;
        return e.target.trim().toLowerCase() === targetKey;
    });
}

/**
 * Checks if a specific volume is excluded (type === "Volume").
 * Does NOT treat a device-level or agent-level silence as a volume exclusion.
 */
export function isVolumeExcluded<T extends IExclusionEntityLike>(
    exclusions: T[],
    deviceName: string,
    agentName: string,
    volumeName: string
): T | undefined {
    const targetKey = buildVolumeTargetKey(deviceName, agentName, volumeName);
    return exclusions.find(e => {
        if (e.type !== "Volume" || !e.target) return false;
        const parts = e.target.split(":");
        if (parts.length >= 3) {
            const eDev = parts[0];
            const eAgent = parts[1];
            const eVol = parts.slice(2).join(":");
            return buildVolumeTargetKey(eDev, eAgent, eVol) === targetKey;
        }
        return (e.target || "").toLowerCase().replace(/\\/g, "/").replace(/\/+$/, "") === targetKey;
    });
}
