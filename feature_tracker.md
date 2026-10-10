# BackupWatch Feature Tracker & Roadmap

This tracker outlines future features, enhancement requests, and architectural discussions for the BackupWatch MSP dashboard.

---

## 1. Mute Alert Button Refinement (Architectural Discussion)

### Goal
Make the **Mute Alert** button available for all appliances instead of relying strictly on Datto's `alertCount` field. The button will serve as a global mechanism to mute alerts. Because Datto has two types of alerts (Appliance-level and Per-agent), we need to discuss and pick how we want to handle muting.

### Discussion Options
* **Option A: Appliance-Level Mute Only**
  - Muting an appliance suppresses all appliance-level alerts (Offline, Storage, Offsite Sync) but does not suppress per-agent backup/screenshot failures.
* **Option B: Cascade Mute (Appliance + Agents)**
  - Muting an appliance automatically mutes all appliance-level alerts AND all agent-level alerts nested under it.
* **Option C: Granular Muting**
  - Allow muting at both levels independently: a "Mute Appliance" button on the main row, and a "Mute Agent" button inside the nested Agent card.

---

## 2. Planned Features & Backlog

### [x] 3-Tier Granular Muting System (Appliance, Agent & Volume)
* **Status**: Completed & Production Deployed (v1.17.0 / v1.23.0)
* **Scope**: Operators can mute at the appliance level, agent level, or specific drive letter/volume level with temporary (1–30 day) or permanent policies and audit logs.

### [x] Overdue Backup Detection (> 24 Hours)
* **Status**: Completed & Production Deployed (v1.18.0)
* **Description**: Identifies and alerts on any active agent whose latest backup run exceeds 24 hours. Features dedicated KPI metric card and table filter.

### [x] Modular SPFx Decomposition
* **Status**: Completed & Production Deployed (v1.23.2)
* **Description**: Split 5,462-line `BackupWatch.tsx` into single-responsibility sub-components (`types/`, `styles/`, `appliance/`, `modals/`).

### [ ] Exclusion Expiry Auto-Notification / Pre-Expiry Warning
* **Status**: Queued / Under Review
* **Description**: Proactively highlight temporary exclusions nearing expiry (<48h or <24h) with visual amber badges and notify engineers before automatic un-silencing occurs.

### [ ] Dynamic Priority Matrix by Alert Severity
* **Status**: Backlog / Future Release
* **Description**: Multi-tier dropdown matrix in the Administrator Console mapping alert severity (P1-P4) directly to Autotask priority IDs.
