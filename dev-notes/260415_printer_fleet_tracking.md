# Printer Fleet Tracking

Track physical printers, their configuration over time, and link print jobs to specific printers.

## Schema Changes

- `Printer` model: serial (PK), model, name, deviceId (FK to ClientDevice), lastSnapshotAt
- `PrinterSnapshot` model: firmware, modules (JSON), amsConfig (JSON), networkIp, activeHmsErrors (JSON), funField, rawReport (JSON), capturedAt. Denormalized deviceId for history.
- `PrintJob`: add optional `printerSerial` field
- `ClientDevice`: add `printers` back-relation

## API

- `POST /api/printer-snapshots` - Client sends snapshot with X-Device-ID header. Upserts Printer, creates PrinterSnapshot.

## Client (splint_client)

- Snapshot collector in `printer-communication-manager.js`
- Triggers on idle + >7 days since last snapshot (or first-ever connect)
- Sends pushall + get_version, assembles JSON, POSTs to factory
- Timestamp persisted in `~/.splint_client/printer_snapshot_ts.txt`

## UI

- `/admin/fleet` page: table of printers with firmware, device, org, last snapshot, HMS errors
- Per-printer detail with snapshot history

## Progress

- [x] Dev-notes plan
- [x] Prisma schema (Printer, PrinterSnapshot, PrintJob.printerSerial)
- [x] Migration (manual via migrate diff + deploy due to stale 2025 records in local DB)
- [x] POST /api/printer-snapshots endpoint
- [x] GET /api/printer-snapshots endpoint (fleet overview + per-printer history)
- [x] Fleet overview UI (/admin/fleet)
- [x] Nav link in Header (SYSTEM_ADMIN only)
- [x] Client-side snapshot collector (printer-communication-manager.js)
- [x] Snapshot poster in main.js (HTTP POST with session cookies)
- [x] Build verified
