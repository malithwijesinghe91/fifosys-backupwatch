# 📊 BackupWatch Volume Exclusion Logic & Workflow Diagram

This document contains a comprehensive visual flowchart illustrating the complete end-to-end lifecycle of **Datto BCDR Volume Exclusions** in BackupWatch — covering automatic background detection, manual dashboard mutes, temporary vs. permanent policy routing, and Autotask ticket integration.

---

## 1. High-Level System Workflow Diagram

```mermaid
flowchart TD
    subgraph S1 ["1. Detection Phase (30-Min Azure Background Scanner)"]
        A["30-Min Timer Trigger Runs"] --> B["Fetch BCDR Devices & Assets from Datto API"]
        B --> C["Scan Volume Statuses"]
        C --> D{"Is Volume Excluded/Unprotected in Datto?"}
        D -- "NO (Protected)" --> E{"Was Volume Previously Excluded in DB?"}
        D -- "YES (Unprotected)" --> F{"Check BackupWatch Exclusions DB"}
    end

    subgraph S2 ["2. Exclusion Classification & Ticketing"]
        F -- "Permanent Note Exists" --> G["Do Nothing (Suppressed)"]
        F -- "Active Temp Note (Not Expired)" --> H["Do Nothing (Active Window)"]
        F -- "No Exclusion Note Exists" --> I["Create Autotask Compliance Ticket"]
        I --> J["Register in DB as Temporary (3 Days)<br/>Linked to Ticket #T..."]
    end

    subgraph S3 ["3. Dashboard Engineer Actions"]
        J --> K["Engineer Opens BackupWatch Dashboard"]
        K --> L{"Engineer Action"}
        L -- "Set Reason & Keep Temporary" --> M["Save DB Record (1, 3, 7, 14, 30 Days)<br/>Push Worklog Note to Autotask Ticket"]
        L -- "Set Reason & Mark Permanent" --> N["Save DB Record (isPermanent = true)<br/>Push Worklog Note to Autotask Ticket"]
        L -- "Remove Exclusion" --> O["Delete Entity from DB<br/>Restore Alerting Immediately"]
    end

    subgraph S4 ["4. Auto-Resolution Path (Volume Fixed in Datto)"]
        E -- "YES (Re-Protected)" --> P["Post RESOLUTION NOTE to Autotask Ticket:<br/>'🟢 Volume re-added to backups'"]
        P --> Q["DO NOT Auto-Close Ticket<br/>(Leave open for engineer manual closure)"]
        Q --> R["Delete Exclusion Record from DB<br/>Restore Normal Dashboard Status"]
        E -- "NO (Still Protected)" --> S["Normal Active Backup"]
    end

    subgraph S5 ["5. Expiry Sweep Path (Temporary 3 Days Expired)"]
        H --> T{"Has Temporary Expiry Date Passed?"}
        T -- "YES" --> U{"Check Autotask Ticket Status"}
        T -- "NO" --> V["Keep Exclusion Active in Dashboard"]
        
        U -- "Ticket STILL OPEN" --> W["Post REMINDER NOTE to Autotask:<br/>'⚠️ Temporary exclusion expired. Check or extend.'"]
        W --> X["Auto-extend Expiry by +24 Hours"]
        
        U -- "Ticket CLOSED (or missing)" --> Y["Remove Exclusion from DB<br/>Restore Dashboard Alert Monitoring"]
        Y --> Z["Create NEW Follow-Up Ticket in Autotask:<br/>'[ATTENTION REQUIRED] Re-verify Exclusion (Ref: Prev Ticket)'"]
    end

    style S1 fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff
    style S2 fill:#1e293b,stroke:#8b5cf6,stroke-width:2px,color:#fff
    style S3 fill:#1e293b,stroke:#f59e0b,stroke-width:2px,color:#fff
    style S4 fill:#1e293b,stroke:#10b981,stroke-width:2px,color:#fff
    style S5 fill:#1e293b,stroke:#ef4444,stroke-width:2px,color:#fff
```

---

## 2. Detailed Decision Logic & Rules Table

```mermaid
flowchart LR
    A["Datto Volume State"] --> B{"Exclusion Policy in DB"}
    
    B -- "None (New Detection)" --> C["1. Create Autotask Ticket<br/>2. Set Temp Expiry: +3 Days"]
    B -- "Temporary (Active)" --> D["Respect Mute Window (No Tickets)"]
    B -- "Temporary (Expired + Open Ticket)" --> E["1. Post Reminder Note to Ticket<br/>2. Extend Expiry: +24 Hours"]
    B -- "Temporary (Expired + Closed Ticket)" --> F["1. Restore Monitoring<br/>2. Open NEW Follow-Up Ticket"]
    B -- "Permanent" --> G["Suppress Alerts Indefinitely"]
    
    style C fill:#3b82f6,color:#fff
    style D fill:#6366f1,color:#fff
    style E fill:#f59e0b,color:#fff
    style F fill:#ef4444,color:#fff
    style G fill:#8b5cf6,color:#fff
```

---

## 3. Key Operational Rules Summary

1. **Auto-Detection**: The 30-minute Azure background scanner automatically picks up any volume marked `unprotected` in Datto.
2. **Default Policy**: Automatically assigns a **Temporary 3-Day Exclusion** linked to the auto-created Autotask compliance ticket.
3. **No Ticket Auto-Closing**: When an engineer fixes the volume in Datto, BackupWatch posts a **Resolution Note** to the ticket asking the engineer to close it manually. Tickets are **NEVER auto-closed** by the system.
4. **Note Push**: Whenever an engineer updates a reason note in the BackupWatch Dashboard, an internal worklog note is instantly pushed to the Autotask ticket with the updated reason and expiry date.
5. **Closed Ticket Escalation**: If a temporary exclusion expires and the ticket was closed prematurely without fixing the volume, BackupWatch **restores active dashboard monitoring** and opens a **NEW follow-up ticket** referencing the previous ticket number.
