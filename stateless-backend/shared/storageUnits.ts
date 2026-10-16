/**
 * Datto storage sizes (BW-024).
 *
 * Datto returns appliance storage as { size, units }. A read-only check of the live device list on
 * 2026-10-16 showed units "KB" for localStorageUsed / localStorageAvailable on all 117 appliances
 * (and "B" for offsiteStorageUsed). Earlier code ignored `units` and treated `size` as bytes, so
 * terabytes were shown as gigabytes. Binary multiples (1 KB = 1024 B), matching the GB maths used
 * across the dashboard.
 */

export interface IDattoSize {
    size?: number;
    units?: string;
}

const BYTES_PER_UNIT: Record<string, number> = {
    B: 1,
    KB: 1024, KIB: 1024,
    MB: 1024 ** 2, MIB: 1024 ** 2,
    GB: 1024 ** 3, GIB: 1024 ** 3,
    TB: 1024 ** 4, TIB: 1024 ** 4
};

const GIB = 1024 ** 3;
// Datto's documented/observed unit for local storage; used when a device omits `units`.
const DEFAULT_UNIT = "KB";

let warnedUnits = new Set<string>();

/** Converts a Datto { size, units } value to GB (binary). Missing or zero size gives 0. */
export function dattoSizeToGB(value: IDattoSize | null | undefined): number {
    if (!value || typeof value.size !== "number" || !isFinite(value.size) || value.size <= 0) return 0;
    const unit = (value.units || "").trim().toUpperCase();
    let multiplier = BYTES_PER_UNIT[unit];
    if (multiplier === undefined) {
        const label = unit || "(missing)";
        if (!warnedUnits.has(label)) {
            warnedUnits.add(label);
            console.warn(`[Datto Storage] Unknown storage unit ${label}; assuming ${DEFAULT_UNIT}. Check the Datto API response.`);
        }
        multiplier = BYTES_PER_UNIT[DEFAULT_UNIT];
    }
    return (value.size * multiplier) / GIB;
}

/** "512.25 GB" below 1 TB, "2.93 TB" from 1024 GB – same rule as the dashboard's storage column. */
export function formatStorageGB(gb: number): string {
    if (gb >= 1024) return `${(gb / 1024).toFixed(2)} TB`;
    return `${gb.toFixed(2)} GB`;
}

/** Test hook: forget which unknown units have already been warned about. */
export function __resetStorageUnitWarningsForTests(): void {
    warnedUnits = new Set<string>();
}
