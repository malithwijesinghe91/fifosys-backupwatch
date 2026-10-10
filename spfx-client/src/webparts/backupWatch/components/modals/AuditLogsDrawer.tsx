import * as React from 'react';

export interface IAuditLogsDrawerProps {
  isOpen: boolean;
  auditLogs: any[];
  auditSearchQuery: string;
  auditLoading: boolean;
  auditError?: string | null;
  onClose: () => void;
  onSearchChange: (query: string) => void;
  onExportCsv: () => void;
}

export const AuditLogsDrawer: React.FC<IAuditLogsDrawerProps> = ({
  isOpen,
  auditLogs,
  auditSearchQuery,
  auditLoading,
  auditError,
  onClose,
  onSearchChange,
  onExportCsv
}) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100000
    }}>
      <div style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border-element)',
        borderRadius: '12px',
        padding: '1.5rem',
        maxWidth: '850px',
        width: '90%',
        boxShadow: 'var(--shadow-lg)',
        boxSizing: 'border-box',
        backdropFilter: 'blur(20px)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-element)', paddingBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
            📜 Audit Trail Log
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            &times;
          </button>
        </div>

        {/* Search input inside modal */}
        <div style={{ marginBottom: '1rem', position: 'relative' }}>
          <input
            type="text"
            placeholder="Search actions, users, or targets..."
            value={auditSearchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bw-search-input"
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ maxHeight: '450px', overflowY: 'auto', marginBottom: '1.5rem', border: '1px solid var(--border-element)', borderRadius: '8px', background: 'var(--bg-glass)' }}>
          {auditLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading audit trail logs...
            </div>
          ) : auditError ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-danger)' }}>
              ⚠️ {auditError}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-element)', background: 'rgba(0,0,0,0.05)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem', fontWeight: 600 }}>Timestamp</th>
                  <th style={{ padding: '0.75rem', fontWeight: 600 }}>User</th>
                  <th style={{ padding: '0.75rem', fontWeight: 600 }}>Action</th>
                  <th style={{ padding: '0.75rem', fontWeight: 600 }}>Target</th>
                  <th style={{ padding: '0.75rem', fontWeight: 600 }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const query = auditSearchQuery.toLowerCase().trim();
                  const filteredLogs = auditLogs.filter(log => {
                    if (!query) return true;
                    return (
                      (log.userEmail && log.userEmail.toLowerCase().includes(query)) ||
                      (log.action && log.action.toLowerCase().includes(query)) ||
                      (log.target && log.target.toLowerCase().includes(query)) ||
                      (log.details && log.details.toLowerCase().includes(query))
                    );
                  });

                  if (filteredLogs.length === 0) {
                    return (
                      <tr>
                        <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No audit log entries found.
                        </td>
                      </tr>
                    );
                  }

                  return filteredLogs.map((log, index) => (
                    <tr key={log.id || index} style={{ borderBottom: '1px solid var(--border-element)' }}>
                      <td style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>
                        {new Date(log.createdTime || log.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {log.userEmail}
                      </td>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                        <span className={`bw-badge ${
                          log.action && log.action.includes('Mute') ? 'warning' :
                          log.action && log.action.includes('Unmute') ? 'success' : 'primary'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {log.target}
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                        {log.details}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={onExportCsv}
            className="bw-btn"
            style={{
              backgroundColor: 'var(--bg-glass)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-element)'
            }}
            title="Export audit logs to RFC-compliant CSV format"
          >
            📥 Export to CSV
          </button>
          <button
            onClick={onClose}
            className="bw-btn"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
              border: 'none'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
