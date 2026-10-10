import * as React from 'react';
import { IDattoDevice } from '../types/BackupWatchTypes';

export interface IMutingModalProps {
  isOpen: boolean;
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
  userSecurityLevel: 'Viewer' | 'Contributor' | 'Specialist' | 'Administrator';
  isEmergencyOverride: boolean;
  onClose: () => void;
  onReasonChange: (reason: string) => void;
  onIsPermanentChange: (isPermanent: boolean) => void;
  onDurationDaysChange: (days: number) => void;
  onEmergencyOverrideChange: (isOverride: boolean) => void;
  onTicketNumberChange: (ticketNumber: string) => void;
  onRemoveExclusion: (exclusionId: string) => void;
  onConfirmSilence: () => void;
}

export const MutingModal: React.FC<IMutingModalProps> = ({
  isOpen,
  mutingDevice,
  mutingAgentName,
  mutingVolume,
  muteType,
  muteReason,
  isPermanent,
  durationDays,
  muteTicketNumber,
  mutingExclusionId,
  actionLoading,
  userSecurityLevel,
  isEmergencyOverride,
  onClose,
  onReasonChange,
  onIsPermanentChange,
  onDurationDaysChange,
  onEmergencyOverrideChange,
  onTicketNumberChange,
  onRemoveExclusion,
  onConfirmSilence
}) => {
  if (!isOpen || !mutingDevice) return null;

  const isSaveDisabled = 
    actionLoading || 
    (isPermanent && (!muteReason || !muteReason.trim())) || 
    (!isEmergencyOverride && (!muteTicketNumber || !muteTicketNumber.trim()));

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
        width: '460px',
        boxShadow: 'var(--shadow-lg)',
        boxSizing: 'border-box',
        backdropFilter: 'blur(20px)'
      }}>
        <h3 style={{ fontSize: '1.2rem', color: 'var(--color-primary)', marginTop: 0, marginBottom: '0.5rem', fontFamily: 'Outfit, sans-serif' }}>
          {muteType === 'Device' && '🔇 Silence Entire Appliance'}
          {muteType === 'Agent' && `🔇 Silence Agent: ${mutingAgentName}`}
          {muteType === 'Volume' && `💾 Volume Exclusion: ${mutingVolume?.name || ''}`}
        </h3>

        <div style={{ 
          background: muteType === 'Volume' ? 'var(--bg-glass)' : 'rgba(100, 116, 139, 0.1)', 
          border: '1px solid var(--border-element)', 
          borderRadius: '8px', 
          padding: '0.65rem 0.8rem', 
          fontSize: '0.78rem', 
          color: 'var(--text-muted)', 
          marginBottom: '1rem', 
          lineHeight: 1.4 
        }}>
          {muteType === 'Device' && (
            <span><strong>Total Blackout:</strong> BackupWatch will completely stop checking this appliance. <strong>0 Autotask tickets</strong> will be created.</span>
          )}
          {muteType === 'Agent' && (
            <span><strong>Agent Blackout:</strong> BackupWatch will stop checking backups, screenshots, and volumes on <strong>{mutingAgentName}</strong>. Other servers remain monitored.</span>
          )}
          {muteType === 'Volume' && (
            <span><strong>Drive Exclusion:</strong> Excludes only this specific volume partition. All other drives and backup checks on this server remain active.</span>
          )}
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>Target</label>
          <input 
            type="text" 
            disabled 
            value={
              muteType === 'Device' 
                ? `${mutingDevice.deviceName} (${mutingDevice.companyName || 'Appliance'})` 
                : (muteType === 'Agent' ? `${mutingDevice.deviceName} ➔ ${mutingAgentName}` : `${mutingDevice.deviceName} ➔ ${mutingVolume?.name}`)
            }
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-glass)',
              border: '1px solid var(--border-element)',
              color: 'var(--text-main)',
              padding: '0.45rem 0.6rem',
              borderRadius: '4px',
              boxSizing: 'border-box',
              fontWeight: 600,
              fontSize: '0.82rem'
            }}
          />
        </div>

        <div style={{ marginBottom: '1.2rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>
            Reason / Business Justification {isPermanent ? <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>* (Required for Permanent)</span> : <span style={{ fontWeight: 400, opacity: 0.7 }}>(Optional for Temporary)</span>}
          </label>
          <textarea 
            value={muteReason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder={isPermanent 
              ? "Mandatory: Detailed business justification required for permanent exclusion (e.g. Server decommissioned / Migrated to Azure)..." 
              : (muteType === 'Device' ? "Optional: e.g. Appliance undergoing hardware replacement or site decommissioning..." : (muteType === 'Agent' ? "Optional: e.g. Server decommissioned / Migrated to Azure..." : "Optional: e.g. Scratch disk / Unprotected log volume"))}
            rows={3}
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-glass)',
              border: (isPermanent && (!muteReason || !muteReason.trim())) ? '1px solid var(--color-danger)' : '1px solid var(--border-element)',
              color: 'var(--text-main)',
              padding: '0.4rem',
              borderRadius: '4px',
              boxSizing: 'border-box',
              fontFamily: 'inherit'
            }}
          />
        </div>

        {/* Exclusion Duration & Type (Temporary vs Permanent) */}
        <div style={{ marginBottom: '1.2rem', padding: '0.8rem', border: '1px solid var(--border-element)', borderRadius: '6px', backgroundColor: 'var(--bg-glass)' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
            Duration Policy
          </label>
          
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.8rem', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-main)', cursor: 'pointer' }}>
              <input 
                type="radio" 
                name="exclusionPolicy" 
                checked={!isPermanent} 
                onChange={() => onIsPermanentChange(false)} 
              />
              🕒 Temporary
            </label>

            <label 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.4rem', 
                fontSize: '0.85rem', 
                color: userSecurityLevel === 'Contributor' ? 'var(--text-muted)' : 'var(--text-main)', 
                cursor: userSecurityLevel === 'Contributor' ? 'not-allowed' : 'pointer',
                opacity: userSecurityLevel === 'Contributor' ? 0.6 : 1
              }}
              title={userSecurityLevel === 'Contributor' ? "Permanent exclusions require Backup Specialist or Administrator permissions." : undefined}
            >
              <input 
                type="radio" 
                name="exclusionPolicy" 
                disabled={userSecurityLevel === 'Contributor'}
                checked={isPermanent} 
                onChange={() => onIsPermanentChange(true)} 
              />
              ♾️ Permanent {userSecurityLevel === 'Contributor' && <span style={{ fontSize: '0.7rem', color: 'var(--color-warning)' }}>(Specialist Only)</span>}
            </label>
          </div>

          {!isPermanent && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Select Duration</label>
              <select 
                value={durationDays}
                onChange={(e) => onDurationDaysChange(parseInt(e.target.value) || 3)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-panel)',
                  border: '1px solid var(--border-element)',
                  color: 'var(--text-main)',
                  padding: '0.4rem',
                  borderRadius: '4px'
                }}
              >
                <option value={1}>1 Day (24 Hours)</option>
                <option value={3}>3 Days (Default Troubleshooting)</option>
                <option value={7}>7 Days (1 Week)</option>
                <option value={14}>14 Days (2 Weeks)</option>
                <option value={30}>30 Days (1 Month)</option>
              </select>
            </div>
          )}
        </div>

        {/* EXCLUSIVE ADMIN PRIVILEGE: EMERGENCY OVERRIDE */}
        {userSecurityLevel === 'Administrator' && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            padding: '0.65rem 0.8rem',
            marginBottom: '1rem'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-danger)', cursor: 'pointer' }}>
              <input 
                type="checkbox"
                checked={isEmergencyOverride}
                onChange={(e) => onEmergencyOverrideChange(e.target.checked)}
              />
              🚨 Emergency Override (Bypass Mandatory Ticket #)
            </label>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.25rem', lineHeight: 1.35 }}>
              <strong>Administrator Privilege:</strong> Allows immediate silencing during critical P1 incidents before a ticket is logged. Tracked in Audit Trail.
            </div>
          </div>
        )}

        {/* Autotask Ticket Number Linking */}
        <div style={{ marginBottom: '1.2rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>
            🎫 Autotask Ticket # {!isEmergencyOverride && <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>*</span>} <span style={{ fontWeight: 400, fontSize: '0.75rem', opacity: 0.8 }}>{isEmergencyOverride ? '(Bypassed via Admin Override)' : '(Required — e.g. T20260817.0138)'}</span>
          </label>
          <input 
            type="text" 
            disabled={isEmergencyOverride}
            value={muteTicketNumber || ''}
            onChange={(e) => onTicketNumberChange(e.target.value)}
            placeholder="e.g. T20260817.0138"
            style={{
              width: '100%',
              backgroundColor: isEmergencyOverride ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-glass)',
              border: (!isEmergencyOverride && (!muteTicketNumber || !muteTicketNumber.trim())) ? '1px solid var(--color-danger)' : '1px solid var(--border-element)',
              color: isEmergencyOverride ? 'var(--color-danger)' : 'var(--text-main)',
              fontWeight: isEmergencyOverride ? 700 : 'normal',
              padding: '0.45rem 0.6rem',
              borderRadius: '4px',
              boxSizing: 'border-box',
              fontSize: '0.82rem'
            }}
          />
          <div style={{ fontSize: '0.7rem', color: (!isEmergencyOverride && (!muteTicketNumber || !muteTicketNumber.trim())) ? 'var(--color-danger)' : 'var(--text-muted)', marginTop: '0.25rem' }}>
            {isEmergencyOverride 
              ? '⚠️ Mandatory ticket check bypassed by Administrator. Logged in Audit Trail.'
              : (!muteTicketNumber || !muteTicketNumber.trim()) 
                ? 'Autotask Ticket # is mandatory for all exclusions and silencing. BackupWatch will post a maintenance worklog note.'
                : 'Mandatory: An audit worklog note will be posted to this Autotask ticket and linked in the dashboard.'}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          {mutingExclusionId && (
            <button
              onClick={() => onRemoveExclusion(mutingExclusionId)}
              disabled={actionLoading}
              className="bw-btn"
              style={{
                backgroundColor: 'var(--color-danger)',
                color: '#ffffff',
                border: 'none',
                marginRight: 'auto'
              }}
            >
              Remove {muteType === 'Volume' ? 'Note' : 'Silence'}
            </button>
          )}
          <button 
            onClick={onClose}
            className="bw-btn"
            style={{ backgroundColor: 'transparent' }}
          >
            Cancel
          </button>
          <button 
            onClick={onConfirmSilence}
            disabled={isSaveDisabled}
            className="bw-btn"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
              border: 'none',
              opacity: isSaveDisabled ? 0.6 : 1
            }}
          >
            {actionLoading ? 'Saving...' : (muteType === 'Volume' ? 'Save Volume Note' : 'Confirm Silence')}
          </button>
        </div>
      </div>
    </div>
  );
};
