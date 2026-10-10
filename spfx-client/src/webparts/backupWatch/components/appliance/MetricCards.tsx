import * as React from 'react';

export interface IMetricCardData {
  title: string;
  value: number | string;
  colorClass: string;
}

export interface IMetricCardsProps {
  loading: boolean;
  activeFilter: string | null;
  isDarkMode: boolean;
  totalAppliances: number;
  screenshotFailuresCount: number;
  storageCriticalCount: number;
  volumeExclusionsCount: number;
  offlineDevicesCount: number;
  localBackupFailuresCount: number;
  offsiteSyncIssuesCount: number;
  overdueBackupsCount: number;
  onFilterToggle: (filterTitle: string | null) => void;
}

export const MetricCards: React.FC<IMetricCardsProps> = ({
  loading,
  activeFilter,
  isDarkMode,
  totalAppliances,
  screenshotFailuresCount,
  storageCriticalCount,
  volumeExclusionsCount,
  offlineDevicesCount,
  localBackupFailuresCount,
  offsiteSyncIssuesCount,
  overdueBackupsCount,
  onFilterToggle
}) => {
  const cards: IMetricCardData[] = [
    { title: 'Total Appliances', value: totalAppliances, colorClass: 'success' },
    { title: 'Screenshot Failures', value: screenshotFailuresCount, colorClass: 'danger' },
    { title: 'Storage Critical (>85%)', value: storageCriticalCount, colorClass: 'warning' },
    { title: 'Volume Exclusions', value: volumeExclusionsCount, colorClass: 'purple' },
    { title: 'Offline Appliances', value: offlineDevicesCount, colorClass: 'danger' },
    { title: 'Local Backup Failures', value: localBackupFailuresCount, colorClass: 'danger' },
    { title: 'Offsite Sync Issues', value: offsiteSyncIssuesCount, colorClass: 'warning' },
    { title: 'Overdue Backups (>24h)', value: overdueBackupsCount, colorClass: 'warning' }
  ];

  const greenZeroCards = [
    'Screenshot Failures',
    'Storage Critical (>85%)',
    'Offline Appliances',
    'Local Backup Failures',
    'Offsite Sync Issues',
    'Overdue Backups (>24h)'
  ];

  return (
    <div className="bw-metrics-grid">
      {cards.map((card) => {
        const isActive = activeFilter === card.title;
        const isZero = card.value === 0 || card.value === '0';
        const useGreen = isZero && greenZeroCards.indexOf(card.title) !== -1;
        const finalColorClass = useGreen ? 'success' : card.colorClass;

        let glowVar = 'var(--glow-primary)';
        let colorVar = 'var(--color-primary)';
        if (card.title === 'Total Appliances') { glowVar = 'var(--glow-success)'; colorVar = 'var(--color-success)'; }
        else if (useGreen) { glowVar = 'var(--glow-success)'; colorVar = 'var(--color-success)'; }
        else if (card.title === 'Screenshot Failures') { glowVar = 'var(--glow-danger)'; colorVar = 'var(--color-danger)'; }
        else if (card.title === 'Storage Critical (>85%)') { glowVar = 'var(--glow-warning)'; colorVar = 'var(--color-warning)'; }
        else if (card.title === 'Volume Exclusions') { glowVar = 'var(--glow-purple)'; colorVar = 'var(--color-purple)'; }
        else if (card.title === 'Offline Appliances') { glowVar = 'var(--glow-danger)'; colorVar = 'var(--color-danger)'; }
        else if (card.title === 'Local Backup Failures') { glowVar = 'var(--glow-danger)'; colorVar = 'var(--color-danger)'; }
        else if (card.title === 'Offsite Sync Issues') { glowVar = 'var(--glow-warning)'; colorVar = 'var(--color-warning)'; }
        else if (card.title === 'Overdue Backups (>24h)') { glowVar = 'var(--glow-warning)'; colorVar = 'var(--color-warning)'; }

        const cardStyle: React.CSSProperties = {
          background: 'var(--bg-glass)',
          border: '1px solid ' + (isActive ? colorVar : 'var(--border-glass)'),
          borderRadius: '12px',
          padding: '1.25rem 1.1rem',
          textAlign: 'center',
          cursor: 'pointer',
          backdropFilter: 'blur(16px)',
          boxShadow: isActive ? `inset 0 0 0 2px ${colorVar}, 0 0 16px ${glowVar}` : 'var(--shadow-sm)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          transform: isActive ? 'scale(0.96)' : 'none'
        };

        return (
          <div
            key={card.title}
            onClick={() => onFilterToggle(card.title === 'Total Appliances' ? null : (isActive ? null : card.title))}
            style={cardStyle}
            className={`bw-metric-card ${finalColorClass}`}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 8px 24px ${glowVar}`;
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.9)';
                e.currentTarget.style.background = isDarkMode ? 'rgba(30, 41, 59, 0.85)' : '#ffffff';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                e.currentTarget.style.borderColor = 'var(--border-glass)';
                e.currentTarget.style.background = 'var(--bg-glass)';
              }
            }}
          >
            {/* Top colored indicator line */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              backgroundColor: colorVar
            }} />

            <div style={{ fontSize: '2.2rem', fontWeight: 800, color: colorVar, marginBottom: '0.25rem', fontFamily: 'Outfit, sans-serif', lineHeight: 1.1 }}>
              {loading ? '...' : card.value}
            </div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {card.title}
            </div>
          </div>
        );
      })}
    </div>
  );
};
