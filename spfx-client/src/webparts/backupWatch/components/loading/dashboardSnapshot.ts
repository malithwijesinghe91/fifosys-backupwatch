/**
 * Last-dashboard copy kept in this browser (web part 1.27.0), so a visit can show the previous
 * data straight away while fresh data loads. Per-viewer convenience only: the server stays the
 * source of truth, the copy expires after 12 hours, and the user's role and email are never
 * stored – change buttons stay hidden until the live response confirms the role.
 * Every storage access is wrapped: if storage is blocked or full, the page simply loads normally.
 */
const STORAGE_KEY = 'backupwatch-dashboard-snapshot-v1';
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface IDashboardSnapshot {
  savedAt: number;
  devices: any[];
  exclusions: any[];
  scanStatus: any | null;
  maintenanceMode: any | null;
  backendVersion?: string;
}

export function loadDashboardSnapshot(): IDashboardSnapshot | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as IDashboardSnapshot;
    if (!snap || typeof snap.savedAt !== 'number' || !Array.isArray(snap.devices) || snap.devices.length === 0) return null;
    if (Date.now() - snap.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      savedAt: snap.savedAt,
      devices: snap.devices,
      exclusions: Array.isArray(snap.exclusions) ? snap.exclusions : [],
      scanStatus: snap.scanStatus || null,
      maintenanceMode: snap.maintenanceMode || null,
      backendVersion: snap.backendVersion
    };
  } catch (e) {
    return null;
  }
}

export function saveDashboardSnapshot(snapshot: Omit<IDashboardSnapshot, 'savedAt'>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...snapshot, savedAt: Date.now() }));
  } catch (e) {
    // Storage blocked or full: drop any old copy rather than keep showing outdated data.
    try { window.localStorage.removeItem(STORAGE_KEY); } catch (e2) { /* ignore */ }
  }
}

/** "just now", "4 min ago", "2 h ago". */
export function describeAge(savedAt: number): string {
  const minutes = Math.floor((Date.now() - savedAt) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}
