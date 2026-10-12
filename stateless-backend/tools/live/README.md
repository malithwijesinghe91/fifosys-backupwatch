# tools/live – scripts that read LIVE production data

> **These scripts connect to the LIVE BackupWatch Azure Table Storage account** using
> `AzureWebJobsStorage` from `stateless-backend/local.settings.json`. They are **read-only**,
> but they still query production data. Never add write, update or delete calls here
> (see `AGENT_PLAYBOOK.md` – no live writes).

## Safety guard

Every script loads `liveGuard.js` first. It:

1. **Refuses to run** unless `--confirm-live` is passed.
2. Prints the **target storage account name** (AccountName only – never the key or the full
   connection string) before any request is made. It does not pause – check `local.settings.json` first.

Run from `stateless-backend/`:

```powershell
node tools/live/check_live_status.js --confirm-live
node tools/live/inspect_specific_entities.js --confirm-live
```

## Scripts

| Script | Tables read | What it does |
|---|---|---|
| `check_live_status.js` | `ScanStatus`, `Exclusions` | Prints the last/next background scan time and status (`Status/BCDRScanner`), the total number of exclusions, and how many have a cached numeric Autotask ticket ID in `ticketUrl`. |
| `inspect_specific_entities.js` | `Exclusions`, `TrackedTickets` | Lists rows mentioning agent `WS-CZC1119JX4` or tickets `T20260907.0203` / `T20260930.0194` (the September 2026 ghost-exclusion investigation). Edit the hard-coded search values to inspect other rows. |

Not deployed: `tools/` is excluded by `stateless-backend/.funcignore`.
