import * as React from 'react';
import { FIFOSYS_ICON_BASE64 } from '../../assets/fifosysLogo';
import { RolePlaceholder } from '../loading/LoadingStates';

export interface IHeaderBarProps {
  isSettingsOpen: boolean;
  userSecurityLevel: string;
  isDarkMode: boolean;
  isFullScreen: boolean;
  userDisplayName: string;
  /** Server-resolved sign-in email (BW-001), shown as a tooltip on the operator badge. */
  userEmail?: string;
  /** False until a live response has confirmed the role; the badge shows a placeholder meanwhile. */
  roleResolved?: boolean;
  onToggleSettings: (isOpen: boolean) => void;
  onOpenAuditLogs: () => void;
  onOpenAdminModal: (tab: 'diagnostics' | 'routing' | 'blackout' | 'cleanup' | 'assetTester') => void;
  onToggleTheme: () => void;
  onToggleFullScreen: () => void;
}

export const HeaderBar: React.FC<IHeaderBarProps> = ({
  isSettingsOpen,
  userSecurityLevel,
  isDarkMode,
  isFullScreen,
  userDisplayName,
  userEmail,
  roleResolved = true,
  onToggleSettings,
  onOpenAuditLogs,
  onOpenAdminModal,
  onToggleTheme,
  onToggleFullScreen
}) => {
  return (
    <div className="bw-header-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <a 
          href="https://www.fifosys.com" 
          target="_blank" 
          rel="noopener noreferrer" 
          style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
          title="Fifosys"
        >
          <img 
            src={FIFOSYS_ICON_BASE64} 
            alt="Fifosys Logo" 
            style={{ 
              height: '48px', 
              width: '48px', 
              objectFit: 'contain', 
              borderRadius: '10px',
              boxShadow: '0 4px 14px rgba(238, 104, 35, 0.35)',
              border: '1.5px solid rgba(255, 255, 255, 0.2)'
            }} 
          />
        </a>
        <div style={{ width: '1px', height: '44px', background: 'rgba(255, 255, 255, 0.2)' }}></div>
        <div>
          <div style={{ 
            fontFamily: 'Outfit, sans-serif', 
            fontSize: '1.95rem', 
            fontWeight: 800, 
            letterSpacing: '-0.02em', 
            lineHeight: 1.1, 
            display: 'flex', 
            alignItems: 'baseline', 
            gap: '0.45rem' 
          }}>
            <span style={{ color: '#FFFFFF' }}>Fifosys</span>
            <span style={{ color: 'var(--color-primary)' }}>BackupWatch</span>
          </div>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.4rem', 
            fontSize: '0.72rem', 
            fontWeight: 600, 
            color: 'var(--text-muted)', 
            letterSpacing: '0.04em', 
            textTransform: 'uppercase', 
            marginTop: '0.3rem' 
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }}></span>
            <span style={{ color: '#8AA4B8' }}>Unified Data Protection Desk</span>
          </div>
        </div>
      </div>
      <div className="bw-header-controls">
        {/* Cluster 1: Mode Switcher (Fleet Desk vs. Exclusions) */}
        <div className="bw-segmented-group">
          <button
            onClick={() => { if (isSettingsOpen) onToggleSettings(false); }}
            className={`bw-seg-btn ${!isSettingsOpen ? 'active' : ''}`}
            title="Switch to Fleet Desk Overview"
          >
            <svg style={{ width: '15px', height: '15px', strokeWidth: 2, stroke: 'currentColor', fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }} viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            Fleet Desk
          </button>
          <button
            onClick={() => { if (!isSettingsOpen) onToggleSettings(true); }}
            className={`bw-seg-btn ${isSettingsOpen ? 'active' : ''}`}
            title="Switch to Exclusions & Silence Manager"
          >
            <svg style={{ width: '15px', height: '15px', strokeWidth: 2, stroke: 'currentColor', fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }} viewBox="0 0 24 24">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
            Exclusions
          </button>
        </div>

        {/* Cluster 2: Governance & Admin Tools */}
        {userSecurityLevel !== 'Viewer' && (
          <button
            onClick={onOpenAuditLogs}
            className="bw-btn-action"
            title="Open System Audit Logs"
          >
            <svg style={{ width: '15px', height: '15px', strokeWidth: 2, stroke: 'currentColor', fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }} viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            Audit Trail
          </button>
        )}

        {userSecurityLevel === 'Administrator' && (
          <button
            onClick={() => onOpenAdminModal('diagnostics')}
            className="bw-btn-action admin"
            title="Open Administrator Console"
          >
            <svg style={{ width: '15px', height: '15px', strokeWidth: 2, stroke: 'currentColor', fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            Admin Console
          </button>
        )}

        {/* Cluster 3: Utility Icon Group */}
        <div className="bw-icon-group">
          <button
            onClick={onToggleTheme}
            className="bw-icon-btn"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? (
              <svg style={{ width: '15px', height: '15px', strokeWidth: 2, stroke: 'currentColor', fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            ) : (
              <svg style={{ width: '15px', height: '15px', strokeWidth: 2, stroke: 'currentColor', fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }} viewBox="0 0 24 24">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            )}
          </button>
          <button
            onClick={onToggleFullScreen}
            className="bw-icon-btn"
            title={isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen'}
          >
            {isFullScreen ? (
              <svg style={{ width: '15px', height: '15px', strokeWidth: 2, stroke: 'currentColor', fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }} viewBox="0 0 24 24">
                <polyline points="4 14 10 14 10 20"></polyline>
                <polyline points="20 10 14 10 14 4"></polyline>
                <line x1="14" y1="10" x2="21" y2="3"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
            ) : (
              <svg style={{ width: '15px', height: '15px', strokeWidth: 2, stroke: 'currentColor', fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }} viewBox="0 0 24 24">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
              </svg>
            )}
          </button>
        </div>

        {/* Cluster 4: Operator Identity with Initials Avatar */}
        <div className="bw-user-pill" title={roleResolved && userEmail ? `${userEmail} (${userSecurityLevel})` : undefined}>
          <div className="bw-user-avatar">
            {(userDisplayName || 'OP').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="bw-user-meta">
            <span className="bw-user-name">{userDisplayName || 'Operator'}</span>
            {!roleResolved ? <RolePlaceholder /> : <span
              className="bw-user-role"
              style={{
                color: userSecurityLevel === 'Administrator' ? '#F87171' :
                       userSecurityLevel === 'Specialist' ? '#C084FC' :
                       userSecurityLevel === 'Contributor' ? '#38BDF8' :
                       '#94A3B8'
              }}
            >
              {userSecurityLevel}
            </span>}
          </div>
        </div>
      </div>
    </div>
  );
};
