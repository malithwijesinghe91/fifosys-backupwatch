import * as React from 'react';
import { IExclusion } from '../types/BackupWatchTypes';

export interface IExclusionsTableProps {
  exclusions: IExclusion[];
  userSecurityLevel: string;
  actionLoading: boolean;
  onRemoveExclusion: (exclusionId: string) => void;
  /** Change freeze active and the user is below Administrator (BW-007). */
  changeLocked?: boolean;
  changeLockedTitle?: string;
}

export const ExclusionsTable: React.FC<IExclusionsTableProps> = ({
  exclusions,
  userSecurityLevel,
  actionLoading,
  onRemoveExclusion,
  changeLocked,
  changeLockedTitle
}) => {
  return (
    <div className="bw-main-card">
      <h2 style={{ fontSize: '1.4rem', color: 'var(--color-primary)', marginTop: 0, marginBottom: '0.5rem', fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
        Active Exclusions List
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem', marginTop: 0 }}>
        The following resources are currently excluded from raising alerts. Exclusions are processed on the server-side to support future automation pipelines.
      </p>
      {exclusions.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'var(--bg-panel)', borderRadius: '8px', border: '1px solid var(--border-element)', color: 'var(--text-muted)' }}>
          No active volume or device exclusions found.
        </div>
      ) : (
        <div className="bw-table-container">
          <table className="bw-table">
            <thead>
              <tr>
                <th style={{ width: '100px' }}>Type</th>
                <th>Target</th>
                <th>Policy</th>
                <th>Reason</th>
                <th>Ticket</th>
                <th>Created Date</th>
                <th style={{ width: '120px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {exclusions.map((exclusion, idx) => (
                <tr key={idx}>
                  <td>
                    <span className={`bw-badge-pill ${exclusion.type === 'Device' ? 'success' : 'purple'}`}>
                      {exclusion.type}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{exclusion.target}</td>
                  <td>
                    {exclusion.isPermanent ? (
                      <span className="bw-badge-pill purple">♾️ Permanent</span>
                    ) : exclusion.expiresAt && !exclusion.isPermanent && exclusion.reason && exclusion.reason.trim().length > 0 ? (
                      <span className="bw-badge-pill orange" title={exclusion.expiresAt ? `Expires: ${new Date(exclusion.expiresAt).toLocaleString()}` : ''}>
                        🕒 Temp {exclusion.expiresAt ? `(${Math.max(0, Math.ceil((new Date(exclusion.expiresAt).getTime() - Date.now()) / 86400000))}d left)` : ''}
                      </span>
                    ) : (
                      <span className="bw-badge-pill success">🎫 Active Ticket</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-main)' }}>{exclusion.reason}</td>
                  <td>
                    {exclusion.ticketNumber ? (
                      <a
                        href={exclusion.ticketUrl || `https://ww16.autotask.net/Mvc/ServiceDesk/TicketDetail.mvc/Index?ticketId=${exclusion.ticketNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--color-success)', textDecoration: 'none', fontWeight: 600 }}
                      >
                        🎫 {exclusion.ticketNumber}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {exclusion.createdTime ? new Date(exclusion.createdTime).toLocaleDateString() : 'N/A'}
                  </td>
                  <td>
                    {userSecurityLevel !== 'Viewer' ? (
                      <button 
                        onClick={() => onRemoveExclusion(exclusion.id)}
                        disabled={actionLoading || changeLocked}
                        title={changeLockedTitle}
                        className="bw-btn bw-change"
                        style={{
                          backgroundColor: 'var(--color-danger)',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '6px'
                        }}
                      >
                        Remove
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
