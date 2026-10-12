import * as React from 'react';

export const BackupWatchStyles: React.FC = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    .backup-watch-root,
    .backup-watch-root * {
      box-sizing: border-box;
    }
    .backup-watch-root {
      /* ── 1. LIGHT MODE (FIFOSYS ENTERPRISE LIGHT) ── */
      --bg-app: #F4F6F9;
      --bg-glass: #FFFFFF;
      --bg-panel: #F8FAFC;
      --bg-hover: rgba(16, 43, 61, 0.04);
      --bg-agent-panel: #F1F5F9;
      --border-glass: #D8E2EC;
      --border-element: #D8E2EC;
      --text-main: #0F1E2A;
      --text-muted: #5A6E7F;
      --text-heading: #0B1E2B;
      
      --shadow-sm: 0 1px 4px rgba(11, 30, 43, 0.06);
      --shadow-md: 0 4px 16px rgba(11, 30, 43, 0.08);
      --shadow-lg: 0 10px 30px rgba(11, 30, 43, 0.12);
      
      --color-primary: #EE6823;
      --color-success: #0F6E56;
      --color-danger: #DC2626;
      --color-warning: #D97706;
      --color-purple: #7C3AED;
      
      --glow-primary: rgba(238, 104, 35, 0.2);
      --glow-success: rgba(15, 110, 86, 0.2);
      --glow-danger: rgba(220, 38, 38, 0.2);
      --glow-warning: rgba(217, 119, 6, 0.2);
      --glow-purple: rgba(124, 58, 237, 0.2);
      
      --header-gradient: linear-gradient(135deg, #102B3D 0%, #14354B 100%);
      --accent-gradient: linear-gradient(135deg, #EE6823 0%, #d45617 100%);
      --transition-speed: 0.25s;
    }

    .backup-watch-root[data-theme="dark"] {
      /* ── 2. DARK MODE (FIFOSYS CYBER NAVY) ── */
      --bg-app: #081621;
      --bg-glass: #0F2535;
      --bg-panel: #143144;
      --bg-hover: rgba(255, 255, 255, 0.06);
      --bg-agent-panel: #0B1D2B;
      --border-glass: #1A3E56;
      --border-element: #1F4A67;
      --text-main: #E2ECF4;
      --text-muted: #8AA4B8;
      --text-heading: #FFFFFF;
      
      --shadow-sm: 0 2px 8px rgba(5, 15, 23, 0.4);
      --shadow-md: 0 8px 32px rgba(5, 15, 23, 0.55);
      --shadow-lg: 0 12px 40px rgba(5, 15, 23, 0.7);
      
      --color-primary: #EE6823;
      --color-success: #10B981;
      --color-danger: #EF4444;
      --color-warning: #F59E0B;
      --color-purple: #A78BFA;
      
      --glow-primary: rgba(238, 104, 35, 0.35);
      --glow-success: rgba(16, 185, 129, 0.35);
      --glow-danger: rgba(239, 68, 68, 0.35);
      --glow-warning: rgba(245, 158, 11, 0.35);
      --glow-purple: rgba(167, 139, 250, 0.35);
      
      --header-gradient: linear-gradient(135deg, #102B3D 0%, #0d2536 50%, #14354B 100%);
      --accent-gradient: linear-gradient(135deg, #EE6823 0%, #d45617 100%);
    }

    .backup-watch-root {
      background: var(--bg-app);
      color: var(--text-main);
      transition: background var(--transition-speed), color var(--transition-speed);
    }

    /* Header card */
    .bw-header-card {
      background: var(--header-gradient);
      border-radius: 16px;
      padding: 1.75rem 2rem;
      box-shadow: var(--shadow-lg);
      position: relative;
      overflow: hidden;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1.5rem;
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.1);
      margin-bottom: 1.5rem;
    }
    .bw-header-card::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -20%;
      width: 140%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 60%);
      pointer-events: none;
    }
    .bw-header-title {
      font-family: 'Outfit', sans-serif;
      font-size: 2.2rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.1;
      margin-bottom: 0.25rem;
      background: linear-gradient(to right, #ffffff, #e0e7ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .bw-header-badge {
      display: inline-flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: #ffffff;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.78rem;
      font-weight: 600;
      margin-bottom: 0.6rem;
      backdrop-filter: blur(4px);
    }
    .bw-btn-header {
      font-family: inherit;
      font-size: 0.85rem;
      font-weight: 600;
      padding: 0.55rem 1.1rem;
      border-radius: 8px;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
      backdrop-filter: blur(8px);
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      box-shadow: var(--shadow-sm);
    }
    .bw-btn-header:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: translateY(-1px);
    }
    .bw-operator-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 0.55rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 500;
      color: #e0e7ff;
    }
    .bw-operator-badge strong {
      color: #ffffff;
      font-weight: 700;
    }

    /* Cache status bar */
    .bw-status-bar {
      background: var(--bg-glass);
      border: 1px solid var(--border-glass);
      border-radius: 10px;
      padding: 0.6rem 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.82rem;
      color: var(--text-muted);
      backdrop-filter: blur(12px);
      box-shadow: var(--shadow-sm);
      margin-bottom: 1.5rem;
    }
    .bw-btn-refresh {
      background: none;
      border: none;
      color: var(--color-primary);
      cursor: pointer;
      font-weight: 700;
      font-size: 0.82rem;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      transition: opacity 0.2s;
    }
    .bw-btn-refresh:hover {
      opacity: 0.8;
      text-decoration: underline;
    }

    /* Metric cards */
    .bw-metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .bw-metric-card {
      background: var(--bg-glass);
      border: 1px solid var(--border-glass);
      border-radius: 12px;
      padding: 1.25rem 1.1rem;
      text-align: center;
      cursor: pointer;
      backdrop-filter: blur(16px);
      box-shadow: var(--shadow-sm);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .bw-metric-card::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      transition: opacity 0.2s;
    }
    .bw-metric-card.primary::after { background: var(--color-primary); }
    .bw-metric-card.success::after { background: var(--color-success); }
    .bw-metric-card.warning::after { background: var(--color-warning); }
    .bw-metric-card.danger::after { background: var(--color-danger); }
    .bw-metric-card.purple::after { background: var(--color-purple); }

    .bw-metric-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg);
      border-color: rgba(255, 255, 255, 0.9);
    }
    .backup-watch-root[data-theme="dark"] .bw-metric-card:hover {
      background: rgba(30, 41, 59, 0.85);
      border-color: rgba(255, 255, 255, 0.15);
    }

    .bw-metric-card.active.primary { box-shadow: inset 0 0 0 2px var(--color-primary), 0 0 16px var(--glow-primary); }
    .bw-metric-card.active.success { box-shadow: inset 0 0 0 2px var(--color-success), 0 0 16px var(--glow-success); }
    .bw-metric-card.active.warning { box-shadow: inset 0 0 0 2px var(--color-warning), 0 0 16px var(--glow-warning); }
    .bw-metric-card.active.danger  { box-shadow: inset 0 0 0 2px var(--color-danger), 0 0 16px var(--glow-danger); }
    .bw-metric-card.active.purple  { box-shadow: inset 0 0 0 2px var(--color-purple), 0 0 16px var(--glow-purple); }

    .bw-metric-card.primary:hover { box-shadow: 0 8px 24px var(--glow-primary); }
    .bw-metric-card.success:hover { box-shadow: 0 8px 24px var(--glow-success); }
    .bw-metric-card.warning:hover { box-shadow: 0 8px 24px var(--glow-warning); }
    .bw-metric-card.danger:hover  { box-shadow: 0 8px 24px var(--glow-danger); }
    .bw-metric-card.purple:hover  { box-shadow: 0 8px 24px var(--glow-purple); }

    .bw-metric-value {
      font-family: 'Outfit', sans-serif;
      font-size: 2.2rem;
      font-weight: 800;
      line-height: 1.1;
      margin-bottom: 0.25rem;
    }
    .bw-metric-value.primary { color: var(--color-primary); }
    .bw-metric-value.success { color: var(--color-success); }
    .bw-metric-value.warning { color: var(--color-warning); }
    .bw-metric-value.danger  { color: var(--color-danger); }
    .bw-metric-value.purple  { color: var(--color-purple); }

    .bw-metric-label {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
    }

    /* Main Card Layout */
    .bw-main-card {
      background: var(--bg-glass);
      border: 1px solid var(--border-glass);
      border-radius: 16px;
      padding: 1.5rem;
      box-shadow: var(--shadow-md);
      backdrop-filter: blur(20px);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .bw-controls-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      border-bottom: 1px solid var(--border-element);
      padding-bottom: 0.8rem;
      margin-bottom: 0.5rem;
    }

    /* Tabs */
    .bw-tabs-group {
      display: flex;
      background: var(--bg-panel);
      padding: 0.25rem;
      border-radius: 8px;
      border: 1px solid var(--border-element);
    }
    .bw-tab-btn {
      background: transparent;
      border: none;
      padding: 0.5rem 1.2rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s;
    }
    .bw-tab-btn:hover {
      color: var(--text-main);
    }
    .bw-tab-btn.active {
      background: var(--bg-glass);
      color: var(--color-primary);
      box-shadow: var(--shadow-sm);
    }

    /* Search */
    .bw-search-wrapper {
      position: relative;
      width: 320px;
      max-width: 100%;
    }
    .search-icon {
      position: absolute;
      left: 0.8rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      font-size: 0.9rem;
      pointer-events: none;
    }
    .bw-search-input {
      box-sizing: border-box;
      width: 100%;
      padding: 0.6rem 1rem 0.6rem 2.4rem;
      border-radius: 8px;
      border: 1px solid var(--border-element);
      background: var(--bg-glass);
      color: var(--text-main);
      font-family: inherit;
      font-size: 0.85rem;
      outline: none;
      transition: all 0.2s;
    }
    .bw-search-input:focus {
      border-color: var(--color-primary);
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(255, 107, 0, 0.15);
    }
    .backup-watch-root[data-theme="dark"] .bw-search-input:focus {
      background: rgba(17, 24, 39, 0.95);
    }

    /* Table styling */
    .bw-table-container {
      overflow-x: auto;
      border-radius: 8px;
      border: 1px solid var(--border-element);
      background: rgba(255, 255, 255, 0.05);
    }
    .bw-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
      text-align: left;
    }
    .bw-table th {
      padding: 0.9rem 1rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      font-size: 0.72rem;
      letter-spacing: 0.08em;
      border-bottom: 2px solid var(--border-element);
      background: var(--bg-panel);
    }
    .bw-table td {
      padding: 0.9rem 1rem;
      border-bottom: 1px solid var(--border-element);
      vertical-align: middle;
    }
    .bw-chevron-col {
      width: 36px;
      min-width: 36px;
      max-width: 36px;
      padding: 0.9rem 0.5rem !important;
      text-align: center;
    }
    .bw-col-model {
      width: 70px;
      min-width: 70px;
      white-space: nowrap;
    }
    .bw-col-lastseen {
      width: 90px;
      min-width: 90px;
      white-space: nowrap;
    }
    .bw-col-exclusions {
      width: 100px;
      min-width: 100px;
      white-space: nowrap;
      text-align: center;
    }
    .bw-col-name {
      width: 240px;
      min-width: 240px;
    }
    .bw-col-storage {
      width: 240px;
      min-width: 240px;
    }
    .bw-col-status {
      width: 150px;
      min-width: 150px;
    }
    .bw-col-actions {
      width: 160px;
      min-width: 160px;
    }
    .bw-appliance-row {
      cursor: pointer;
      transition: background-color 0.2s;
    }
    .bw-appliance-row:hover {
      background-color: var(--bg-hover);
    }
    .bw-appliance-row.expanded {
      background-color: rgba(255, 107, 0, 0.03);
    }
    .bw-chevron-indicator {
      display: inline-block;
      font-size: 0.75rem;
      color: var(--color-primary);
      transition: transform 0.2s ease-in-out;
      margin-right: 0.4rem;
    }
    .bw-appliance-row.expanded .bw-chevron-indicator {
      transform: rotate(90deg);
    }

    /* Agents Panel */
    .bw-agents-panel {
      background: var(--bg-panel);
      padding: 1.5rem;
      border-left: 5px solid var(--color-primary);
    }
    .bw-agents-panel-title {
      font-family: 'Outfit', sans-serif;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-primary);
      margin-bottom: 1rem;
    }
    .bw-agents-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(450px, 1fr));
      gap: 1rem;
    }
    .bw-agent-card {
      background: var(--bg-glass);
      border: 1px solid var(--border-glass);
      border-radius: 12px;
      padding: 1.1rem;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      transition: all 0.2s;
    }
    .bw-agent-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
      border-color: rgba(255, 107, 0, 0.25);
    }

    .bw-volume-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--bg-panel);
      border: 1px solid var(--border-element);
      border-radius: 6px;
      padding: 0.35rem 0.6rem;
      font-size: 0.75rem;
    }
    .bw-volume-row.excluded {
      border-color: rgba(244, 63, 94, 0.15);
    }

    /* Badges & Progress */
    .bw-badge-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 700;
      white-space: nowrap;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .bw-badge-pill.success {
      background: var(--badge-success-bg, rgba(16, 185, 129, 0.12));
      color: var(--badge-success-color, var(--color-success));
      border: 1px solid var(--badge-success-border, rgba(16, 185, 129, 0.25));
    }
    .bw-badge-pill.danger {
      background: var(--badge-danger-bg, rgba(244, 63, 94, 0.12));
      color: var(--badge-danger-color, var(--color-danger));
      border: 1px solid var(--badge-danger-border, rgba(244, 63, 94, 0.25));
    }
    .bw-badge-pill.warning {
      background: var(--badge-warning-bg, rgba(245, 158, 11, 0.12));
      color: var(--badge-warning-color, var(--color-warning));
      border: 1px solid var(--badge-warning-border, rgba(245, 158, 11, 0.25));
    }
    .bw-badge-pill.purple {
      background: var(--badge-purple-bg, rgba(139, 92, 246, 0.12));
      color: var(--badge-purple-color, var(--color-purple));
      border: 1px solid var(--badge-purple-border, rgba(139, 92, 246, 0.25));
    }
    .bw-badge-pill.orange {
      background: rgba(238, 104, 35, 0.15);
      color: var(--color-primary);
      border: 1px solid rgba(238, 104, 35, 0.35);
    }

    .bw-progress-bar-track {
      width: 100%;
      max-width: 160px;
      height: 8px;
      background: var(--border-element);
      border-radius: 9999px;
      overflow: hidden;
    }
    .bw-progress-bar-fill {
      height: 100%;
      border-radius: 9999px;
      transition: width 0.3s ease;
    }
    .bw-progress-bar-fill.success { background: var(--color-success); }
    .bw-progress-bar-fill.warning { background: var(--color-warning); }
    .bw-progress-bar-fill.danger  { background: var(--color-danger); }

    /* Change freeze (BW-007): change buttons locked for non-Administrators */
    .backup-watch-root .bw-change:disabled {
      opacity: 0.45 !important;
      cursor: not-allowed !important;
      transform: none !important;
      box-shadow: none !important;
    }

    /* Premium Buttons */
    .bw-btn {
      font-family: inherit;
      font-size: 0.85rem;
      font-weight: 600;
      padding: 0.55rem 1.1rem;
      border-radius: 8px;
      cursor: pointer;
      border: 1px solid var(--border-element);
      background: var(--bg-glass);
      color: var(--text-main);
      backdrop-filter: blur(8px);
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      box-shadow: var(--shadow-sm);
    }
    .bw-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      background: #ffffff;
    }
    .backup-watch-root[data-theme="dark"] .bw-btn:hover {
      background: #1f2937;
      color: #ffffff;
    }

    .bw-header-controls {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    /* Option 1 Modern Segmented Header Toolbar */
    .bw-segmented-group {
      display: inline-flex;
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 8px;
      padding: 3px;
      gap: 3px;
    }
    .bw-seg-btn {
      background: transparent;
      border: none;
      color: #94A3B8;
      font-family: inherit;
      font-size: 0.78rem;
      font-weight: 600;
      padding: 0.45rem 0.8rem;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.18s ease;
    }
    .bw-seg-btn:hover {
      color: #FFFFFF;
      background: rgba(255, 255, 255, 0.08);
    }
    .bw-seg-btn.active {
      background: rgba(255, 255, 255, 0.16);
      color: #FFFFFF;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
    }
    .bw-btn-action {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.14);
      color: #E2E8F0;
      font-family: inherit;
      font-size: 0.78rem;
      font-weight: 600;
      padding: 0.48rem 0.82rem;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.18s ease;
    }
    .bw-btn-action:hover {
      background: rgba(255, 255, 255, 0.14);
      border-color: rgba(255, 255, 255, 0.28);
      color: #FFFFFF;
      transform: translateY(-1px);
    }
    .bw-btn-action.admin {
      background: rgba(239, 68, 68, 0.12);
      border-color: rgba(239, 68, 68, 0.35);
      color: #FCA5A5;
    }
    .bw-btn-action.admin:hover {
      background: rgba(239, 68, 68, 0.24);
      border-color: rgba(239, 68, 68, 0.55);
      color: #FFFFFF;
      box-shadow: 0 0 12px rgba(239, 68, 68, 0.3);
    }
    .bw-icon-group {
      display: inline-flex;
      background: rgba(0, 0, 0, 0.22);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      padding: 3px;
      gap: 2px;
    }
    .bw-icon-btn {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: #94A3B8;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }
    .bw-icon-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #FFFFFF;
    }
    .bw-user-pill {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      background: rgba(0, 0, 0, 0.28);
      border: 1px solid rgba(255, 255, 255, 0.14);
      padding: 0.32rem 0.75rem 0.32rem 0.38rem;
      border-radius: 9999px;
      font-size: 0.8rem;
    }
    .bw-user-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, #EE6823, #D85614);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.72rem;
      color: #FFFFFF;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    }
    .bw-user-meta {
      display: flex;
      flex-direction: column;
      line-height: 1.15;
    }
    .bw-user-name {
      font-weight: 600;
      color: #FFFFFF;
      font-size: 0.78rem;
    }
    .bw-user-role {
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    /* Responsive styling and classes */
    @media (max-width: 1024px) {
      .bw-metrics-grid {
        grid-template-columns: repeat(3, 1fr) !important;
      }
    }

    @media (max-width: 768px) {
      .bw-metrics-grid {
        grid-template-columns: repeat(2, 1fr) !important;
      }
      .bw-search-wrapper {
        width: 100% !important;
      }
      .bw-controls-row {
        flex-direction: column !important;
        align-items: stretch !important;
      }
      
      /* Responsive table columns */
      .bw-col-model, .bw-col-exclusions {
        display: none !important;
      }

      .bw-agents-cards-grid {
        grid-template-columns: 1fr !important;
      }
    }

    @media (max-width: 480px) {
      .bw-metrics-grid {
        grid-template-columns: 1fr !important;
      }
      .bw-header-controls {
        flex-direction: column !important;
        width: 100% !important;
        align-items: stretch !important;
      }
      .bw-btn {
        justify-content: center !important;
      }
      .bw-col-lastseen {
        display: none !important;
      }
    }
  ` }} />
);
