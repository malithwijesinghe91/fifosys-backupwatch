import * as React from 'react';
import { IDattoDevice, IEscalatableIssue } from '../types/BackupWatchTypes';

export interface IEscalationModalProps {
  isOpen: boolean;
  escalateDevice: IDattoDevice | null;
  escalateIssues: IEscalatableIssue[];
  selectedIssueIds: { [key: string]: boolean };
  actionLoading: boolean;
  onClose: () => void;
  onToggleIssue: (issueId: string, checked: boolean) => void;
  onConfirmEscalate: () => void;
}

export const EscalationModal: React.FC<IEscalationModalProps> = ({
  isOpen,
  escalateDevice,
  escalateIssues,
  selectedIssueIds,
  actionLoading,
  onClose,
  onToggleIssue,
  onConfirmEscalate
}) => {
  if (!isOpen || !escalateDevice) return null;

  const hasSelection = Object.keys(selectedIssueIds).some(k => selectedIssueIds[k]);

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
        width: '450px',
        boxShadow: 'var(--shadow-lg)',
        boxSizing: 'border-box',
        backdropFilter: 'blur(20px)'
      }}>
        <h3 style={{ fontSize: '1.2rem', color: 'var(--color-primary)', marginTop: 0, marginBottom: '0.5rem', fontFamily: 'Outfit, sans-serif' }}>
          Escalate Ticket to AutoTask
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.2rem', marginTop: 0 }}>
          Select the issues you want to escalate. This will create a separate AutoTask ticket for each selected issue under the mapped company.
        </p>

        <div style={{
          maxHeight: '250px',
          overflowY: 'auto',
          border: '1px solid var(--border-element)',
          borderRadius: '6px',
          padding: '0.5rem',
          backgroundColor: 'var(--bg-glass)',
          marginBottom: '1.5rem'
        }}>
          {escalateIssues.map((issue: IEscalatableIssue) => (
            <label 
              key={issue.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                padding: '0.4rem',
                borderBottom: '1px solid var(--border-element)',
                cursor: 'pointer',
                fontSize: '0.82rem',
                color: 'var(--text-main)'
              }}
            >
              <input 
                type="checkbox"
                checked={!!selectedIssueIds[issue.id]}
                onChange={(e) => onToggleIssue(issue.id, e.target.checked)}
                style={{ marginTop: '0.2rem' }}
              />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                  {issue.type}: {issue.targetName} — {issue.issueType}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                  {issue.description}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button 
            onClick={onClose}
            className="bw-btn"
            style={{ backgroundColor: 'transparent' }}
          >
            Cancel
          </button>
          <button 
            onClick={onConfirmEscalate}
            disabled={actionLoading || !hasSelection}
            className="bw-btn"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
              border: 'none',
              opacity: actionLoading ? 0.6 : 1
            }}
          >
            {actionLoading ? 'Escalating...' : 'Confirm Escalation'}
          </button>
        </div>
      </div>
    </div>
  );
};
