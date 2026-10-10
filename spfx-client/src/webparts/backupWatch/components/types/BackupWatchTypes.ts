export interface IAgentResult {
  name: string;
  status: 'Active' | 'Paused' | 'Archived' | 'Silenced';
  isPaused: boolean;
  isArchived: boolean;
  isSilenced?: boolean;
  excludedVolumes: { name: string; reason: string }[];
  excludedVolumesCount: number;
  protectedVolumeNames: string[];
  unprotectedVolumeNames?: string[];
  osName?: string;
  lastSnapshot?: string;
  lastBackupStatus?: {
    success: boolean;
    time?: number | string;
    errorMessage?: string;
  } | null;
  screenshotVerification?: {
    success: boolean;
    time?: number | string;
    image?: string;
  } | null;
}

export interface IDattoDevice {
  deviceName: string;
  companyName?: string;
  model: string;
  serialNumber: string;
  usedStorageGB: number;
  totalStorageGB: number;
  storageUsedPercent: number;
  backupStatus: 'Success' | 'Failed' | 'Muted';
  exclusionReason: string | null;
  requiresAction: boolean;
  applianceExclusionsCount: number;
  agents: IAgentResult[];
  volumes: any[];
  isActive: boolean;
  lastCheckin?: number | null;
  status?: 'offline' | 'online';
  isOffline?: boolean;
  storageTicketReference?: { ticketId: string; status: string } | null;
}

export interface IExclusion {
  id: string;
  type: 'Device' | 'Agent' | 'Volume';
  target: string;
  reason: string;
  createdTime: string;
  isPermanent?: boolean;
  expiresAt?: string | null;
  ticketNumber?: string | null;
  ticketUrl?: string | null;
}

export interface IEscalatableIssue {
  id: string;
  type: 'Appliance' | 'Agent';
  targetName: string;
  issueType: 'Storage' | 'OffsiteSync' | 'Offline' | 'Backup' | 'Screenshot' | 'Paused' | 'Archived';
  description: string;
  lastSeenMessage: string;
}

export interface IBackupWatchState {
  devices: IDattoDevice[];
  exclusions: IExclusion[];
  loading: boolean;
  error: string | null;
  cacheStatus: string | null;
  expandedAppliances: { [key: string]: boolean };
  activeTab: 'active' | 'cancelled';
  activeFilter: string | null;
  isFullScreen: boolean;
  
  // UI states
  isSettingsOpen: boolean;
  isMutingModalOpen: boolean;
  mutingDevice: IDattoDevice | null;
  mutingAgentName: string | null;
  mutingVolume: any | null;
  muteType: 'Device' | 'Agent' | 'Volume';
  muteReason: string;
  isPermanent: boolean;
  durationDays: number;
  muteTicketNumber: string;
  mutingExclusionId: string | null;
  actionLoading: boolean;

  // Escalation UI states
  isEscalateModalOpen: boolean;
  escalateDevice: IDattoDevice | null;
  escalateIssues: IEscalatableIssue[];
  selectedIssueIds: { [key: string]: boolean };
  copiedTicketId?: string | null;
  searchQuery: string;
  currentPage: number;
  pageSize: number;
  isDarkMode: boolean;
  isAuditLogsOpen: boolean;
  auditLogs: any[];
  auditSearchQuery: string;
  auditLoading: boolean;
  auditError?: string | null;
  scanStatus: {
    lastScan: string;
    nextScan: string;
    status: string;
    errorMessage?: string;
  } | null;
  backendVersion?: string;
  userSecurityLevel: 'Viewer' | 'Contributor' | 'Specialist' | 'Administrator';
  securityRolesLoading: boolean;
  isAdminModalOpen: boolean;
  adminModalTab: 'diagnostics' | 'routing' | 'blackout' | 'cleanup' | 'assetTester';
  adminDiagnostics: any | null;
  adminDiagnosticsLoading: boolean;
  adminDiagnosticsError?: string | null;
  adminRoutingData: any | null;
  alertMatrix: Record<string, any> | null;
  adminRoutingLoading: boolean;
  adminRoutingSaving: boolean;
  adminRoutingSavedNotice: boolean;
  selectedAdminQueueId?: number;
  selectedAdminPriorityId?: number;
  selectedAdminCategoryId?: number;
  selectedAdminWorkTypeId?: number;
  isEmergencyOverride: boolean;
  globalMaintenanceMode?: any | null;
  blackoutDurationHours: number;
  blackoutReason: string;
  blackoutSaving: boolean;
  cleanupScanning: boolean;
  cleanupPurging: boolean;
  cleanupData: any | null;
  selectedCleanupTickets: { partitionKey: string; rowKey: string }[];
  selectedCleanupExclusions: { partitionKey: string; rowKey: string }[];
  assetTestQuery: string;
  assetTestLoading: boolean;
  assetTestResult: any | null;
  auditExporting: boolean;
}
