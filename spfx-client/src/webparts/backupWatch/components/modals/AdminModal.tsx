import * as React from 'react';

export interface IAdminModalProps {
  isOpen: boolean;
  userSecurityLevel: 'Viewer' | 'Contributor' | 'Specialist' | 'Administrator';
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

  onClose: () => void;
  onTabChange: (tab: 'diagnostics' | 'routing' | 'blackout' | 'cleanup' | 'assetTester') => void;
  onFetchDiagnostics: () => void;
  onFetchRouting: () => void;
  onSaveRouting: () => void;
  onUpdateAlertMatrixItem: (alertKey: string, field: string, value: any, extraFields?: Record<string, any>) => void;
  onQueueChange: (queueId?: number) => void;
  onPriorityChange: (priorityId?: number) => void;
  onCategoryChange: (categoryId?: number) => void;
  onWorkTypeChange: (workTypeId?: number) => void;
  onFetchMaintenance: () => void;
  onSaveMaintenance: (isActive: boolean) => void;
  onBlackoutDurationChange: (hours: number) => void;
  onBlackoutReasonChange: (reason: string) => void;
  onFetchCleanup: () => void;
  onPurgeCleanup: () => void;
  onAssetTestQueryChange: (query: string) => void;
  onRunAssetTest: () => void;
}

export const AdminModal: React.FC<IAdminModalProps> = ({
  isOpen,
  userSecurityLevel,
  adminModalTab,
  adminDiagnostics,
  adminDiagnosticsLoading,
  adminDiagnosticsError,
  adminRoutingData,
  alertMatrix,
  adminRoutingLoading,
  adminRoutingSaving,
  adminRoutingSavedNotice,
  selectedAdminQueueId,
  selectedAdminPriorityId,
  selectedAdminCategoryId,
  selectedAdminWorkTypeId,
  globalMaintenanceMode,
  blackoutDurationHours,
  blackoutReason,
  blackoutSaving,
  cleanupScanning,
  cleanupPurging,
  cleanupData,
  selectedCleanupTickets,
  selectedCleanupExclusions,
  assetTestQuery,
  assetTestLoading,
  assetTestResult,

  onClose,
  onTabChange,
  onFetchDiagnostics,
  onFetchRouting,
  onSaveRouting,
  onUpdateAlertMatrixItem,
  onQueueChange,
  onPriorityChange,
  onCategoryChange,
  onWorkTypeChange,
  onFetchMaintenance,
  onSaveMaintenance,
  onBlackoutDurationChange,
  onBlackoutReasonChange,
  onFetchCleanup,
  onPurgeCleanup,
  onAssetTestQueryChange,
  onRunAssetTest
}) => {
  if (!isOpen || userSecurityLevel !== 'Administrator') return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100000,
      backdropFilter: 'blur(6px)'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border-element)',
        borderRadius: '14px',
        padding: '1.75rem',
        width: adminModalTab === 'routing' ? '1320px' : '880px',
        maxWidth: '96vw',
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: 'var(--shadow-lg)',
        boxSizing: 'border-box',
        transition: 'width 0.25s ease-in-out'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-element)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.35rem', fontFamily: 'Outfit, sans-serif', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚙️</span> Administrator Console
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            &times;
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-element)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              onTabChange('diagnostics');
              onFetchDiagnostics();
            }}
            style={{
              background: adminModalTab === 'diagnostics' ? 'var(--bg-hover)' : 'transparent',
              color: adminModalTab === 'diagnostics' ? 'var(--color-primary)' : 'var(--text-muted)',
              border: 'none',
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            🩺 Diagnostics
          </button>
          <button
            onClick={() => {
              onTabChange('routing');
              onFetchRouting();
            }}
            style={{
              background: adminModalTab === 'routing' ? 'var(--bg-hover)' : 'transparent',
              color: adminModalTab === 'routing' ? 'var(--color-primary)' : 'var(--text-muted)',
              border: 'none',
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            🔀 Routing & Picklists
          </button>
          <button
            onClick={() => {
              onTabChange('blackout');
              onFetchMaintenance();
            }}
            style={{
              background: adminModalTab === 'blackout' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
              color: adminModalTab === 'blackout' ? '#ef4444' : 'var(--text-muted)',
              border: 'none',
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            🚨 Alert Blackout
          </button>
          <button
            onClick={() => {
              onTabChange('cleanup');
              onFetchCleanup();
            }}
            style={{
              background: adminModalTab === 'cleanup' ? 'var(--bg-hover)' : 'transparent',
              color: adminModalTab === 'cleanup' ? 'var(--color-primary)' : 'var(--text-muted)',
              border: 'none',
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            🧹 Entity Cleanup
          </button>
          <button
            onClick={() => {
              onTabChange('assetTester');
            }}
            style={{
              background: adminModalTab === 'assetTester' ? 'var(--bg-hover)' : 'transparent',
              color: adminModalTab === 'assetTester' ? 'var(--color-primary)' : 'var(--text-muted)',
              border: 'none',
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            🔍 Asset Diagnostic
          </button>
        </div>

        {/* TAB 1: DIAGNOSTICS */}
        {adminModalTab === 'diagnostics' && (
          <div>
            {adminDiagnosticsLoading && (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                <div className="pulse-dot" style={{ backgroundColor: 'var(--color-primary)', display: 'inline-block', marginBottom: '0.5rem' }} />
                <div>Scanning API health, pinging endpoints, and aggregating table statistics...</div>
              </div>
            )}

            {adminDiagnosticsError && (
              <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                ⚠️ {adminDiagnosticsError}
              </div>
            )}

            {!adminDiagnosticsLoading && adminDiagnostics && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  {/* Autotask Card */}
                  <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-element)', borderRadius: '10px', padding: '1.1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>Autotask REST API</strong>
                      <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        ● {adminDiagnostics.autotask.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      <span>Latency:</span>
                      <strong style={{ color: 'var(--color-success)' }}>{adminDiagnostics.autotask.latencyMs} ms</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      <span>Zone Endpoint:</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{adminDiagnostics.autotask.baseUrl || 'Zone 14 Auto-resolved'}</span>
                    </div>
                  </div>

                  {/* Datto Card */}
                  <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-element)', borderRadius: '10px', padding: '1.1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>Datto BCDR API</strong>
                      <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        ● {adminDiagnostics.datto.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      <span>In-Memory Cache:</span>
                      <strong style={{ color: adminDiagnostics.datto.cache?.isCached ? 'var(--color-success)' : 'var(--color-warning)' }}>
                        {adminDiagnostics.datto.cache?.isCached ? `HIT (TTL ${adminDiagnostics.datto.cache.ttlRemainingSeconds}s remaining)` : 'STALE / READY TO FETCH'}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      <span>Cached Appliances:</span>
                      <strong>{adminDiagnostics.datto.cache?.cachedDeviceCount || 0} appliances</strong>
                    </div>
                  </div>

                  {/* Table Storage Card */}
                  <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-element)', borderRadius: '10px', padding: '1.1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>Azure Table Storage</strong>
                      <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        ● {adminDiagnostics.storage.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      <span>Active Exclusions:</span>
                      <strong>{adminDiagnostics.storage.exclusionsCount} entities</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      <span>Tracked Autotask Tickets:</span>
                      <strong>{adminDiagnostics.storage.trackedTicketsCount} entities</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      <span>Audit Trail Logs:</span>
                      <strong>{adminDiagnostics.storage.auditLogsCount} entries</strong>
                    </div>
                  </div>

                  {/* Background Scanner Card */}
                  <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-element)', borderRadius: '10px', padding: '1.1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>30-Min Auto-Heal Scanner</strong>
                      <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-success)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        ● {adminDiagnostics.scanner.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      <span>Last Sweep:</span>
                      <strong>{adminDiagnostics.scanner.lastScan || 'Active'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      <span>Next Scheduled Sweep:</span>
                      <strong style={{ color: 'var(--color-primary)' }}>{adminDiagnostics.scanner.nextScan || 'Every 30 Minutes'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      <span>Runtime Engine:</span>
                      <span>Node {adminDiagnostics.nodeVersion} (Flex Consump.)</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', borderTop: '1px solid var(--border-element)', paddingTop: '1rem' }}>
                  <button
                    onClick={onFetchDiagnostics}
                    className="bw-btn"
                    style={{ backgroundColor: 'transparent' }}
                  >
                    🔄 Refresh Health Status
                  </button>
                  <button
                    onClick={onClose}
                    className="bw-btn"
                    style={{ backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none' }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: AUTOTASK LIVE ROUTING */}
        {adminModalTab === 'routing' && (
          <div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.45 }}>
              Configure default ticket routing and picklist rules for automated compliance tickets and manual escalations. Changes persist immediately to Azure Table Storage without restarting Function App instances.
            </p>

            {adminRoutingSavedNotice && (
              <div style={{ padding: '0.8rem 1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>✓</span> Routing configuration saved successfully! Active on all subsequent tickets and escalations.
              </div>
            )}

            {adminRoutingLoading && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                Loading live Autotask queues and field options...
              </div>
            )}

            {!adminRoutingLoading && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                  {/* Queue Dropdown */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                      🎯 Default Escalation Queue
                    </label>
                    <select
                      value={selectedAdminQueueId || ''}
                      onChange={(e) => onQueueChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--bg-glass)',
                        border: '1px solid var(--border-element)',
                        color: 'var(--text-main)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem'
                      }}
                    >
                      {adminRoutingData?.options?.queues?.map((q: any) => (
                        <option key={q.value} value={q.value}>{q.label} (ID: {q.value})</option>
                      ))}
                    </select>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                      Queue where all automated compliance and manual escalation tickets are dispatched.
                    </span>
                  </div>

                  {/* Priority Dropdown */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                      ⚡ Default Ticket Priority
                    </label>
                    <select
                      value={selectedAdminPriorityId || 2}
                      onChange={(e) => onPriorityChange(parseInt(e.target.value, 10) || 2)}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--bg-glass)',
                        border: '1px solid var(--border-element)',
                        color: 'var(--text-main)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem'
                      }}
                    >
                      {adminRoutingData?.options?.priorities?.map((p: any) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                      Initial Autotask ticket priority (Medium is recommended default).
                    </span>
                  </div>

                  {/* Category Dropdown */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                      🏷️ Ticket Category
                    </label>
                    <select
                      value={selectedAdminCategoryId || ''}
                      onChange={(e) => onCategoryChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--bg-glass)',
                        border: '1px solid var(--border-element)',
                        color: 'var(--text-main)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem'
                      }}
                    >
                      {adminRoutingData?.options?.categories?.map((c: any) => (
                        <option key={c.value} value={c.value}>{c.label} (ID: {c.value})</option>
                      ))}
                    </select>
                  </div>

                  {/* Work Type Dropdown */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                      🔧 Default Work Type / Allocation Code
                    </label>
                    <select
                      value={selectedAdminWorkTypeId || ''}
                      onChange={(e) => onWorkTypeChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--bg-glass)',
                        border: '1px solid var(--border-element)',
                        color: 'var(--text-main)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem'
                      }}
                    >
                      {adminRoutingData?.options?.workTypes?.map((w: any) => (
                        <option key={w.value} value={w.value}>{w.label} (ID: {w.value})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 7-Alert Routing & Classification Matrix */}
                <div style={{ marginTop: '1.75rem', marginBottom: '1.5rem' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}>
                    <h4 style={{
                      margin: 0,
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: 'var(--text-main)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span>🔀</span> Per-Alert Routing & Classification Matrix
                    </h4>
                  </div>

                  {/* Safety & Operational Guarantee Banner */}
                  <div style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: '8px',
                    padding: '0.65rem 0.9rem',
                    marginBottom: '1rem',
                    fontSize: '0.78rem',
                    color: 'var(--color-success)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}>
                    <div>
                      <strong>🛡️ Operational Safety Policy:</strong> Automated background ticketing is active <strong>strictly for Volume Exclusions</strong>. All other 6 alert types default to <strong>Monitoring & Manual Escalation only</strong> (Auto-Ticket: OFF).
                    </div>
                    <span style={{ fontSize: '0.7rem', opacity: 0.85, fontWeight: 600 }}>Backwards-Compatible</span>
                  </div>

                  {/* Matrix Table */}
                  <div style={{ border: '1px solid var(--border-element)', borderRadius: '10px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', tableLayout: 'fixed' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-muted)', textAlign: 'left' }}>
                          <th style={{ padding: '0.7rem 0.75rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', width: '20%' }}>Alert Type</th>
                          <th style={{ padding: '0.7rem 0.75rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', width: '18%' }}>Autotask Queue</th>
                          <th style={{ padding: '0.7rem 0.75rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', width: '11%' }}>Priority</th>
                          <th style={{ padding: '0.7rem 0.75rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', width: '18%' }}>Issue & Sub-Issue</th>
                          <th style={{ padding: '0.7rem 0.75rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', width: '26%' }}>Ticket Title Template</th>
                          <th style={{ padding: '0.7rem 0.75rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', width: '7%', textAlign: 'center' }}>Auto-Ticket</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { key: 'VolumeExclusion', icon: '⚠️', title: 'Volume Exclusions', desc: 'System drive / critical volume excluded (Active in Prod)', isProdActive: true },
                          { key: 'StorageAlert', icon: '💾', title: 'Storage Alerts', desc: 'Appliance pool >85% (Warning) or >90% (Critical)', isProdActive: false },
                          { key: 'LocalBackupFailure', icon: '❌', title: 'Local Backup Failures', desc: 'Latest local snapshot explicitly failed', isProdActive: false },
                          { key: 'OverdueBackup', icon: '⏱️', title: 'Overdue Backups', desc: 'No successful backup in >24 hours', isProdActive: false },
                          { key: 'OffsiteSyncIssue', icon: '☁️', title: 'Offsite Sync Issues', desc: 'Cloud replication backlog >100GB or stalled >48h', isProdActive: false },
                          { key: 'ScreenshotFailure', icon: '📸', title: 'Screenshot Failures', desc: 'Daily verification boot test failed', isProdActive: false },
                          { key: 'OfflineAppliance', icon: '🔌', title: 'Offline Appliances', desc: 'Appliance check-in overdue >30 minutes', isProdActive: false }
                        ].map((alertDef) => {
                          const matrixItem = alertMatrix?.[alertDef.key] || {};
                          const isEnabled = matrixItem.autoTicketEnabled !== undefined ? matrixItem.autoTicketEnabled : alertDef.isProdActive;
                          const priorityVal = matrixItem.priorityId !== undefined ? matrixItem.priorityId : (alertDef.key === 'StorageAlert' || alertDef.key === 'OfflineAppliance' ? 4 : alertDef.key === 'LocalBackupFailure' ? 1 : alertDef.key === 'OverdueBackup' || alertDef.key === 'OffsiteSyncIssue' ? 2 : 3);
                          const priorityLabel = priorityVal === 4 ? 'Critical' : priorityVal === 1 ? 'High' : priorityVal === 2 ? 'Medium' : 'Low';

                          return (
                            <tr key={alertDef.key} style={{
                              borderBottom: '1px solid var(--border-element)',
                              backgroundColor: alertDef.isProdActive ? 'rgba(16, 185, 129, 0.03)' : 'transparent'
                            }}>
                              <td style={{ padding: '0.75rem' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span>{alertDef.icon}</span> {alertDef.title}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem', marginLeft: '1.4rem' }}>
                                  {alertDef.desc}
                                </div>
                              </td>
                              <td style={{ padding: '0.75rem' }}>
                                <select
                                  value={matrixItem.queueId || (selectedAdminQueueId || 29683511)}
                                  onChange={(e) => onUpdateAlertMatrixItem(alertDef.key, 'queueId', parseInt(e.target.value, 10))}
                                  style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    backgroundColor: 'var(--bg-glass)',
                                    border: '1px solid var(--border-element)',
                                    color: 'var(--text-main)',
                                    padding: '0.38rem 0.5rem',
                                    borderRadius: '6px',
                                    fontSize: '0.78rem'
                                  }}
                                >
                                  {adminRoutingData?.options?.queues?.map((q: any) => (
                                    <option key={q.value} value={q.value}>{q.label} (ID: {q.value})</option>
                                  ))}
                                </select>
                              </td>
                              <td style={{ padding: '0.75rem' }}>
                                <select
                                  value={priorityVal}
                                  onChange={(e) => onUpdateAlertMatrixItem(alertDef.key, 'priorityId', parseInt(e.target.value, 10))}
                                  style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    backgroundColor: 'var(--bg-glass)',
                                    border: '1px solid var(--border-element)',
                                    color: 'var(--text-main)',
                                    padding: '0.38rem 0.5rem',
                                    borderRadius: '6px',
                                    fontSize: '0.78rem'
                                  }}
                                >
                                  <option value={4}>Critical (P1)</option>
                                  <option value={1}>High (P2)</option>
                                  <option value={2}>Medium (P3)</option>
                                  <option value={3}>Low (P4)</option>
                                </select>
                                <div style={{
                                  display: 'block',
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '4px',
                                  fontWeight: 700,
                                  fontSize: '0.68rem',
                                  textAlign: 'center',
                                  marginTop: '0.3rem',
                                  backgroundColor: priorityVal === 4 ? 'rgba(239, 68, 68, 0.12)' : priorityVal === 1 ? 'rgba(245, 158, 11, 0.12)' : priorityVal === 2 ? 'rgba(59, 130, 246, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                                  color: priorityVal === 4 ? '#ef4444' : priorityVal === 1 ? '#b45309' : priorityVal === 2 ? '#2563eb' : '#475569',
                                  border: `1px solid ${priorityVal === 4 ? 'rgba(239, 68, 68, 0.3)' : priorityVal === 1 ? 'rgba(245, 158, 11, 0.3)' : priorityVal === 2 ? 'rgba(59, 130, 246, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`
                                }}>
                                  {priorityLabel}
                                </div>
                              </td>
                              <td style={{ padding: '0.75rem' }}>
                                {(() => {
                                  const currentIssueId = String(matrixItem.issueTypeId || (alertDef.key === 'OfflineAppliance' ? 24 : 30));
                                  const allSubIssues = adminRoutingData?.options?.subIssueTypes || [];
                                  const matchingSubIssues = allSubIssues.filter((sit: any) => String(sit.parentValue) === currentIssueId);
                                  const activeSubValue = matchingSubIssues.some((s: any) => s.value === matrixItem.subIssueTypeId)
                                    ? matrixItem.subIssueTypeId
                                    : (matchingSubIssues.length > 0 ? matchingSubIssues[0].value : (matrixItem.subIssueTypeId || ''));

                                  return (
                                    <>
                                      <div style={{ marginBottom: '0.35rem' }}>
                                        <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.15rem', fontWeight: 600 }}>
                                          Issue:
                                        </label>
                                        <select
                                          value={matrixItem.issueTypeId || (alertDef.key === 'OfflineAppliance' ? 24 : 30)}
                                          onChange={(e) => {
                                            const newIssueId = parseInt(e.target.value, 10);
                                            const childSubs = allSubIssues.filter((s: any) => String(s.parentValue) === String(newIssueId));
                                            onUpdateAlertMatrixItem(alertDef.key, 'issueTypeId', newIssueId, {
                                              subIssueTypeId: childSubs.length > 0 ? childSubs[0].value : undefined
                                            });
                                          }}
                                          style={{
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            backgroundColor: 'var(--bg-glass)',
                                            border: '1px solid var(--border-element)',
                                            color: 'var(--text-main)',
                                            padding: '0.35rem 0.5rem',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem'
                                          }}
                                        >
                                          {adminRoutingData?.options?.issueTypes && adminRoutingData.options.issueTypes.length > 0 ? (
                                            adminRoutingData.options.issueTypes.map((it: any) => (
                                              <option key={it.value} value={it.value}>{it.label} (ID: {it.value})</option>
                                            ))
                                          ) : (
                                            <option value={matrixItem.issueTypeId || (alertDef.key === 'OfflineAppliance' ? 24 : 30)}>Loading Issue Types...</option>
                                          )}
                                        </select>
                                      </div>

                                      <div>
                                        <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.15rem', fontWeight: 600 }}>
                                          Sub-Issue {matchingSubIssues.length > 0 ? `(${matchingSubIssues.length} available)` : ''}:
                                        </label>
                                        <select
                                          value={activeSubValue}
                                          onChange={(e) => onUpdateAlertMatrixItem(alertDef.key, 'subIssueTypeId', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                                          disabled={matchingSubIssues.length === 0}
                                          style={{
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            backgroundColor: matchingSubIssues.length === 0 ? 'rgba(0,0,0,0.05)' : 'var(--bg-glass)',
                                            border: '1px solid var(--border-element)',
                                            color: matchingSubIssues.length === 0 ? 'var(--text-muted)' : 'var(--text-main)',
                                            padding: '0.35rem 0.5rem',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem'
                                          }}
                                        >
                                          {matchingSubIssues.length > 0 ? (
                                            matchingSubIssues.map((sit: any) => (
                                              <option key={sit.value} value={sit.value}>{sit.label} (ID: {sit.value})</option>
                                            ))
                                          ) : allSubIssues.length > 0 ? (
                                            <option value="">-- No Sub-Issues for this Issue Type --</option>
                                          ) : (
                                            <option value={matrixItem.subIssueTypeId || ''}>Loading Sub-Issues...</option>
                                          )}
                                        </select>
                                      </div>
                                    </>
                                  );
                                })()}
                              </td>
                              <td style={{ padding: '0.75rem' }}>
                                <input
                                  type="text"
                                  value={matrixItem.titleTemplate !== undefined ? matrixItem.titleTemplate : (
                                    alertDef.key === 'VolumeExclusion' ? 'Volume Exclusion Detected - {Device} - {Agent} - {Detail}' :
                                    alertDef.key === 'StorageAlert' ? '[{Company}] Storage Warning: {Device} at {Detail} Capacity' :
                                    alertDef.key === 'LocalBackupFailure' ? '[{Company}] Backup Failure: {Agent} on {Device}' :
                                    alertDef.key === 'OverdueBackup' ? '[{Company}] Backup Overdue: {Agent} ({Detail})' :
                                    alertDef.key === 'OffsiteSyncIssue' ? '[{Company}] Cloud Replication Stalled - {Device} ({Detail})' :
                                    alertDef.key === 'ScreenshotFailure' ? '[{Company}] Screenshot Boot Failure - {Agent}' :
                                    '[{Company}] URGENT: Appliance Offline - {Device}'
                                  )}
                                  onChange={(e) => onUpdateAlertMatrixItem(alertDef.key, 'titleTemplate', e.target.value)}
                                  style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    backgroundColor: 'var(--bg-glass)',
                                    border: '1px solid var(--border-element)',
                                    color: 'var(--text-main)',
                                    padding: '0.38rem 0.55rem',
                                    borderRadius: '6px',
                                    fontSize: '0.78rem'
                                  }}
                                />
                                <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                  Tokens: <code style={{ color: 'var(--color-primary)' }}>{'{Company}'}</code> <code style={{ color: 'var(--color-primary)' }}>{'{Device}'}</code> <code style={{ color: 'var(--color-primary)' }}>{'{Agent}'}</code> <code style={{ color: 'var(--color-primary)' }}>{'{Detail}'}</code>
                                </div>
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isEnabled}
                                  onChange={(e) => onUpdateAlertMatrixItem(alertDef.key, 'autoTicketEnabled', e.target.checked)}
                                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                  title={alertDef.isProdActive ? "Currently active in production" : "Monitored on dashboard; tick to enable auto-ticketing"}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', borderTop: '1px solid var(--border-element)', paddingTop: '1rem' }}>
                  <button
                    onClick={onClose}
                    className="bw-btn"
                    style={{ backgroundColor: 'transparent' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onSaveRouting}
                    disabled={adminRoutingSaving}
                    className="bw-btn"
                    style={{ backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none' }}
                  >
                    {adminRoutingSaving ? 'Saving...' : '💾 Save Routing Configuration'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: GLOBAL ALERT BLACKOUT */}
        {adminModalTab === 'blackout' && (
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-main)', fontSize: '1.1rem' }}>
                🚨 Global Maintenance Mode & Alert Silence Blackout
              </h4>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Temporarily silence automated Autotask compliance ticket creation across all appliances during planned maintenance windows, emergency server reboots, or Datto cloud migrations.
              </p>
            </div>

            {/* Current Status Card */}
            <div style={{
              backgroundColor: globalMaintenanceMode?.isActive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
              border: `1px solid ${globalMaintenanceMode?.isActive ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
              borderRadius: '10px',
              padding: '1.25rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Current System Status
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.25rem', color: globalMaintenanceMode?.isActive ? '#ef4444' : '#10b981' }}>
                    {globalMaintenanceMode?.isActive ? '🚨 BLACKOUT ACTIVE (Ticketing Silenced)' : '✅ NORMAL OPERATION (Ticketing Active)'}
                  </div>
                  {globalMaintenanceMode?.isActive && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', marginTop: '0.4rem' }}>
                      <div>Expires: <strong>{globalMaintenanceMode.expiresAt ? new Date(globalMaintenanceMode.expiresAt).toLocaleString() : 'Manual Deactivation Only'}</strong></div>
                      <div>Activated By: <strong>{globalMaintenanceMode.activatedBy || 'Administrator'}</strong></div>
                      <div>Reason: <em>"{globalMaintenanceMode.reason || 'Planned Maintenance'}"</em></div>
                    </div>
                  )}
                </div>
                {globalMaintenanceMode?.isActive && (
                  <button
                    onClick={() => onSaveMaintenance(false)}
                    disabled={blackoutSaving}
                    className="bw-btn"
                    style={{ backgroundColor: '#10b981', color: '#ffffff', border: 'none', fontWeight: 700 }}
                  >
                    {blackoutSaving ? 'Deactivating...' : '✅ Resume Normal Ticketing'}
                  </button>
                )}
              </div>
            </div>

            {/* Activation Form (when not active or to update) */}
            {!globalMaintenanceMode?.isActive && (
              <div style={{ backgroundColor: 'var(--bg-glass)', border: '1px solid var(--border-element)', borderRadius: '10px', padding: '1.25rem' }}>
                <h5 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: 'var(--text-main)' }}>
                  Activate New Maintenance Blackout Window
                </h5>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                      Duration
                    </label>
                    <select
                      value={blackoutDurationHours}
                      onChange={(e) => onBlackoutDurationChange(Number(e.target.value))}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--bg-panel)',
                        border: '1px solid var(--border-element)',
                        color: 'var(--text-main)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem'
                      }}
                    >
                      <option value={1}>1 Hour</option>
                      <option value={2}>2 Hours (Recommended)</option>
                      <option value={4}>4 Hours</option>
                      <option value={8}>8 Hours</option>
                      <option value={24}>24 Hours (Full Day)</option>
                      <option value={48}>48 Hours (Weekend)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                      Maintenance Reason / Change Ticket #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Planned SAN firmware upgrade (CR-84920)"
                      value={blackoutReason}
                      onChange={(e) => onBlackoutReasonChange(e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--bg-panel)',
                        border: '1px solid var(--border-element)',
                        color: 'var(--text-main)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem' }}>
                  <button
                    onClick={() => onSaveMaintenance(true)}
                    disabled={blackoutSaving}
                    className="bw-btn"
                    style={{ backgroundColor: '#ef4444', color: '#ffffff', border: 'none', fontWeight: 700 }}
                  >
                    {blackoutSaving ? 'Activating...' : '🚨 Activate Global Blackout'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ENTITY & TICKET CLEANUP */}
        {adminModalTab === 'cleanup' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-main)', fontSize: '1.1rem' }}>
                  🧹 Stale Ticket & Entity Cleanup Tool
                </h4>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Detect and purge orphan records in Azure Table Storage that reference decommissioned or deleted Datto appliances.
                </p>
              </div>
              <button
                onClick={onFetchCleanup}
                disabled={cleanupScanning}
                className="bw-btn"
                style={{ fontSize: '0.8rem' }}
              >
                {cleanupScanning ? 'Scanning...' : '🔄 Re-scan Tables'}
              </button>
            </div>

            {cleanupScanning && (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                <div className="pulse-dot" style={{ backgroundColor: 'var(--color-primary)', display: 'inline-block', marginBottom: '0.5rem' }} />
                <div>Scanning TrackedTickets and Exclusions against live inventory...</div>
              </div>
            )}

            {!cleanupScanning && cleanupData && (
              <div>
                {/* Stats Overview */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ backgroundColor: 'var(--bg-glass)', border: '1px solid var(--border-element)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active Inventory Devices</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981', marginTop: '0.2rem' }}>
                      {cleanupData.stats?.activeAppliancesCount ?? 0}
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-glass)', border: '1px solid var(--border-element)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Orphan Tickets</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: (cleanupData.stats?.orphanTicketsCount ?? 0) > 0 ? '#ef4444' : '#10b981', marginTop: '0.2rem' }}>
                      {cleanupData.stats?.orphanTicketsCount ?? 0}
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-glass)', border: '1px solid var(--border-element)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Orphan Exclusions</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: (cleanupData.stats?.orphanExclusionsCount ?? 0) > 0 ? '#f59e0b' : '#10b981', marginTop: '0.2rem' }}>
                      {cleanupData.stats?.orphanExclusionsCount ?? 0}
                    </div>
                  </div>
                </div>

                {/* Orphan Tickets Section */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    Orphan Tracked Tickets ({cleanupData.orphanTickets?.length || 0})
                  </div>
                  {(!cleanupData.orphanTickets || cleanupData.orphanTickets.length === 0) ? (
                    <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: 'var(--bg-glass)', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      ✅ No orphan tickets found. All tracked tickets map to active appliances.
                    </div>
                  ) : (
                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-element)', borderRadius: '6px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(0,0,0,0.05)', textAlign: 'left', borderBottom: '1px solid var(--border-element)' }}>
                            <th style={{ padding: '0.5rem' }}>Serial (PartitionKey)</th>
                            <th style={{ padding: '0.5rem' }}>Target (RowKey)</th>
                            <th style={{ padding: '0.5rem', fontWeight: 600 }}>Ticket #</th>
                            <th style={{ padding: '0.5rem' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cleanupData.orphanTickets.map((t: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-element)' }}>
                              <td style={{ padding: '0.5rem' }}><code>{t.partitionKey}</code></td>
                              <td style={{ padding: '0.5rem' }}>{t.rowKey}</td>
                              <td style={{ padding: '0.5rem', fontWeight: 600 }}>{t.ticketNumber}</td>
                              <td style={{ padding: '0.5rem' }}>{t.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Orphan Exclusions Section */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    Orphan Exclusions ({cleanupData.orphanExclusions?.length || 0})
                  </div>
                  {(!cleanupData.orphanExclusions || cleanupData.orphanExclusions.length === 0) ? (
                    <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: 'var(--bg-glass)', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      ✅ No orphan exclusions found.
                    </div>
                  ) : (
                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-element)', borderRadius: '6px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(0,0,0,0.05)', textAlign: 'left', borderBottom: '1px solid var(--border-element)' }}>
                            <th style={{ padding: '0.5rem' }}>Type</th>
                            <th style={{ padding: '0.5rem' }}>Target</th>
                            <th style={{ padding: '0.5rem' }}>Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cleanupData.orphanExclusions.map((e: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-element)' }}>
                              <td style={{ padding: '0.5rem' }}><span className="bw-badge-pill purple">{e.type}</span></td>
                              <td style={{ padding: '0.5rem' }}>{e.target}</td>
                              <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>{e.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Action Bar */}
                {((cleanupData.orphanTickets?.length || 0) > 0 || (cleanupData.orphanExclusions?.length || 0) > 0) && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', borderTop: '1px solid var(--border-element)', paddingTop: '1rem' }}>
                    <button
                      onClick={onPurgeCleanup}
                      disabled={cleanupPurging}
                      className="bw-btn"
                      style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', fontWeight: 700 }}
                    >
                      {cleanupPurging ? 'Purging...' : `🗑️ Purge ${selectedCleanupTickets.length + selectedCleanupExclusions.length} Orphan Records`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: AUTOTASK ASSET DIAGNOSTIC */}
        {adminModalTab === 'assetTester' && (
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-main)', fontSize: '1.1rem' }}>
                🔍 Live Autotask Asset & Company Diagnostic
              </h4>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Test live configuration item resolution and contract mapping in Autotask without creating tickets.
              </p>
            </div>

            {/* Search Query Input */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <input
                type="text"
                placeholder="Enter appliance serial number (e.g. 5fc660...) or server hostname..."
                value={assetTestQuery}
                onChange={(e) => onAssetTestQueryChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onRunAssetTest(); }}
                style={{
                  flex: 1,
                  backgroundColor: 'var(--bg-glass)',
                  border: '1px solid var(--border-element)',
                  color: 'var(--text-main)',
                  padding: '0.6rem 0.9rem',
                  borderRadius: '8px',
                  fontSize: '0.88rem'
                }}
              />
              <button
                onClick={onRunAssetTest}
                disabled={assetTestLoading}
                className="bw-btn"
                style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff', border: 'none', fontWeight: 600 }}
              >
                {assetTestLoading ? 'Testing...' : '⚡ Test Resolution'}
              </button>
            </div>

            {/* Results Display */}
            {assetTestLoading && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                <div className="pulse-dot" style={{ backgroundColor: 'var(--color-primary)', display: 'inline-block', marginBottom: '0.5rem' }} />
                <div>Querying Autotask API across 4-tier candidate resolution...</div>
              </div>
            )}

            {!assetTestLoading && assetTestResult && (
              <div style={{
                backgroundColor: 'var(--bg-glass)',
                border: '1px solid var(--border-element)',
                borderRadius: '10px',
                padding: '1.25rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-element)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>
                      {assetTestResult.matchFound ? '✅' : '❌'}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                      {assetTestResult.matchFound ? 'Configuration Item Match Found' : 'No Configuration Item Matched'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    Latency: {assetTestResult.latencyMs} ms
                  </span>
                </div>

                {assetTestResult.matchFound && assetTestResult.configurationItem && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', fontSize: '0.85rem' }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Autotask CI ID</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        #{assetTestResult.configurationItem.id}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Matched Serial Number</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {assetTestResult.configurationItem.serialNumber || '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Resolved Company</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {assetTestResult.configurationItem.companyName} (ID: {assetTestResult.configurationItem.companyId})
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Resolved Contract</div>
                      <div style={{ fontWeight: 600, color: assetTestResult.configurationItem.contract ? '#10b981' : 'var(--text-muted)' }}>
                        {assetTestResult.configurationItem.contract ? `${assetTestResult.configurationItem.contract.name} (ID: ${assetTestResult.configurationItem.contract.id})` : 'None / Default'}
                      </div>
                    </div>
                  </div>
                )}

                {!assetTestResult.matchFound && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    Autotask could not find an active or inactive Configuration Item matching "<code>{assetTestResult.query}</code>". Please ensure this device is onboarded in Autotask under an active company.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
