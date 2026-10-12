import * as React from 'react';
import { describeAge } from './dashboardSnapshot';

/**
 * Loading experience (web part 1.27.0): skeleton table in the shape of the real dashboard, a
 * time-based status line with a small spinner, a "showing earlier data" strip and error panels
 * with Retry. Animations stop when the viewer has "reduce motion" turned on (see .bw-skel /
 * .bw-spinner in BackupWatchStyles).
 */

/** Status text for how long the current request has been running. */
export function loadingMessage(elapsedMs: number): string {
  const s = elapsedMs / 1000;
  if (s < 3) return 'Connecting to BackupWatch…';
  if (s < 8) return 'Fetching appliance data from Datto…';
  if (s < 20) return 'Checking tickets and exclusions…';
  if (s < 40) return 'Still working – the first load after a quiet spell takes longer…';
  return 'This is taking longer than usual…';
}

export const Spinner: React.FC = () => <span className="bw-spinner" aria-hidden="true" />;

const NAME_WIDTHS = ['62%', '48%', '70%', '55%', '66%', '44%', '58%', '51%'];

/** First load with nothing to show yet: status line plus skeleton rows matching the appliance table. */
export const DashboardSkeleton: React.FC<{ elapsedMs: number }> = ({ elapsedMs }) => (
  <div aria-busy="true">
    <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
      <Spinner />
      <span>{loadingMessage(elapsedMs)}</span>
    </div>
    <div className="bw-table-container" aria-hidden="true">
      <table className="bw-table">
        <thead>
          <tr>
            <th className="bw-chevron-col"></th>
            <th className="bw-col-name">Appliance Name</th>
            <th className="bw-col-model">Model / Serial</th>
            <th className="bw-col-storage">Local Storage</th>
            <th className="bw-col-lastseen">Last Seen</th>
            <th className="bw-col-status">Backup Status</th>
            <th className="bw-col-exclusions">Exclusions</th>
            <th className="bw-col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {NAME_WIDTHS.map((nameWidth, i) => (
            <tr key={i}>
              <td className="bw-chevron-col"><span className="bw-skel" style={{ width: '14px', height: '14px' }} /></td>
              <td>
                <span className="bw-skel" style={{ width: nameWidth, height: '0.85rem', marginBottom: '0.35rem' }} />
                <span className="bw-skel" style={{ width: '35%', height: '0.65rem' }} />
              </td>
              <td><span className="bw-skel" style={{ width: '75%', height: '0.75rem' }} /></td>
              <td><span className="bw-skel" style={{ width: '90%', height: '0.5rem' }} /></td>
              <td><span className="bw-skel" style={{ width: '60%', height: '0.75rem' }} /></td>
              <td><span className="bw-skel" style={{ width: '4.5rem', height: '1.2rem', borderRadius: '999px' }} /></td>
              <td><span className="bw-skel" style={{ width: '1.5rem', height: '0.75rem' }} /></td>
              <td><span className="bw-skel" style={{ width: '4.5rem', height: '1.6rem' }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/**
 * Thin strip above the table while data is on screen: showing an earlier copy, refreshing after a
 * change, or a refresh that failed (with Retry).
 */
export const RefreshStrip: React.FC<{
  refreshing: boolean;
  snapshotSavedAt: number | null;
  error: string | null;
  elapsedMs: number;
  onRetry: () => void;
}> = ({ refreshing, snapshotSavedAt, error, elapsedMs, onRetry }) => {
  if (error) {
    return (
      <div role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.82rem', padding: '0.55rem 0.85rem', margin: '0 0 0.75rem', borderRadius: '8px', border: '1px solid var(--color-warning)', color: 'var(--text-main)' }}>
        <span>
          Couldn't refresh the dashboard{snapshotSavedAt ? ` – showing data from ${describeAge(snapshotSavedAt)}` : ''}. {error}
        </span>
        <button type="button" className="bw-btn" onClick={onRetry} style={{ padding: '0.3rem 0.8rem', fontSize: '0.78rem' }}>Retry</button>
      </div>
    );
  }
  if (!refreshing && !snapshotSavedAt) return null;
  return (
    <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
      {refreshing && <Spinner />}
      <span>
        {snapshotSavedAt
          ? `Showing data from ${describeAge(snapshotSavedAt)}${refreshing ? ` · ${loadingMessage(elapsedMs)}` : ''}`
          : 'Refreshing…'}
      </span>
    </div>
  );
};

/** First load failed and there is nothing to show. */
export const LoadErrorPanel: React.FC<{ error: string; onRetry: () => void }> = ({ error, onRetry }) => (
  <div role="alert" style={{ textAlign: 'center', padding: '2.5rem 1rem', border: '1px solid var(--border-element)', borderRadius: '12px' }}>
    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>Couldn't load the dashboard</div>
    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{error}</div>
    <button type="button" className="bw-btn" onClick={onRetry}>Retry</button>
  </div>
);

/** Placeholder for the role badge until the live response confirms the role. */
export const RolePlaceholder: React.FC = () => (
  <span className="bw-skel" aria-hidden="true" style={{ width: '3.5rem', height: '0.6rem', marginTop: '0.2rem' }} />
);
