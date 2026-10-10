# Fifosys BackupWatch - Feature Roadmap & Backlog

This document tracks approved ideas, planned features, and candidate enhancements for upcoming releases of BackupWatch.

---

## 📋 Feature Backlog

### [Current: v1.23.2 | Future Release Candidates]

#### 1. 🔔 Exclusion Expiry Auto-Notification / Pre-Expiry Warning
- **Status**: Queued / Next Candidate
- **Description**: Provide automated visibility before temporary exclusions expire (e.g., 24h/48h remaining) using visual badge highlights and automated notification workflows before the engine resumes Autotask compliance ticket generation.

#### 2. 🎯 Dynamic Priority Matrix by Alert Severity
- **Status**: Queued / Planned for Future Release
- **Description**: Replace the single global default priority setting with an automated severity-to-priority routing matrix.
- **Mapping Proposal**:
  - **Critical (P1 / P2)**: Appliance Storage >90% capacity or Appliance Offline >48h.
  - **Medium (P3)**: Backup Failure >24h or Storage >85%.
  - **Low (P4)**: Volume Exclusion detected, Paused Agent, or Screenshot Boot Warning.
- **Admin Configuration**: Multi-tier dropdown matrix inside the Routing & Picklists tab of the Administrator Console.

#### 2. 🔀 Issue Type & Sub-Issue Type Granular Classification
- **Status**: Under Active Investigation
- **Description**: Query Autotask's hierarchical issueType and subIssueType picklist fields so tickets are pre-classified for Service Desk dispatching.

#### 3. 📝 Customizable Ticket Title & Description Template Prefixes
- **Status**: Under Discussion / Exploration
- **Description**: Allow Administrators to customize ticket naming conventions and body formats with dynamic tokens ({CompanyName}, {DeviceName}, {AgentName}, {IssueType}).
