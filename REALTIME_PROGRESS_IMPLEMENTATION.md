# Real-Time Print Progress Implementation

## Overview
Implemented real-time print progress tracking and display using Server-Sent Events (SSE) for server-to-client updates and REST API for client-to-server updates.

## Architecture

### Server-Sent Events (SSE)
**Why SSE instead of WebSocket?**
- Better compatibility with Next.js App Router and serverless deployments
- Simpler implementation for one-way real-time updates (server → client)
- Automatic reconnection handling by the browser
- Works through most proxies and firewalls

**Endpoint:** `GET /api/print-queue/events`
- Streams real-time updates to all connected clients
- Sends heartbeat every 30 seconds to keep connection alive
- Automatically cleans up disconnected clients
- Broadcasts progress updates to all subscribers

### Progress Update API
**Endpoint:** `PUT /api/print-queue/[id]/progress`
- Receives progress updates from Electron client
- Validates progress value (0-100)
- Updates database with progress and timestamp
- Broadcasts update to all connected SSE clients

**Request body:**
```json
{
  "progress": 45.3,
  "filename": "optional_filename_for_correlation"
}
```

**Response:**
```json
{
  "success": true,
  "id": "print_job_id",
  "progress": 45.3
}
```

## Client Implementation

### Print Queue List Page
**Features:**
1. **SSE Connection:**
   - Auto-connects on mount
   - Auto-reconnects on disconnect (5-second delay)
   - Updates individual entries in real-time
   
2. **Printer Status Polling (Electron only):**
   - Polls printer status every 5 seconds
   - Displays active printer banner with filename and progress
   - Sends progress updates to server via API
   
3. **Progress Display:**
   - Shows progress % in status badge (e.g., "Printing 45.3%")
   - Shows "Updated Xm ago" below status
   - Compact layout for 800x480 screen

### Print Queue Detail Page
**Features:**
1. **SSE Connection:**
   - Auto-connects when viewing specific job
   - Only updates progress for this specific job
   - Auto-reconnects on disconnect
   
2. **Progress Display:**
   - Full progress bar (0-100%)
   - Exact percentage display
   - Last update timestamp with freshness indicators:
     - 🟢 Green "(just now)" - < 1 minute
     - ⚪ Gray "(Xm ago)" - < 1 hour
     - 🟠 Orange "(Xh ago)" - > 1 hour
   - "Waiting for updates..." message when no data yet

## Database Schema

### PrintQueue Model
```prisma
model PrintQueue {
  // ... existing fields ...
  progress               Float?    // Print progress percentage (0-100)
  progressLastReportTime DateTime? // When progress was last updated
}
```

**Migration:** `20251007224908_add_print_progress_fields`

## Data Flow

### Progress Update Flow (Electron Client → Server → All Clients)

```
1. Electron Client (Print Queue Page)
   └─> Polls printer status every 5s
       └─> Detects active print with progress
           └─> Finds matching print job in local state
               └─> PUT /api/print-queue/[id]/progress
                   
2. Server (Progress API)
   └─> Validates authentication
       └─> Validates progress value
           └─> Updates database (progress, progressLastReportTime)
               └─> Broadcasts update via SSE
               
3. All Connected Clients (SSE)
   └─> Receive broadcast message
       └─> Update local state for matching job
           └─> UI re-renders with new progress
```

### Display Flow (Initial Load)

```
1. Client loads Print Queue page
   └─> Fetches print queue data (GET /api/print-queue)
       ├─> Includes progress and progressLastReportTime
       └─> Renders initial state
           
2. Client connects to SSE
   └─> Establishes persistent connection
       └─> Listens for real-time updates
```

## File Structure

```
splint_factory/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── print-queue/
│   │   │       ├── events/
│   │   │       │   └── route.ts          # SSE endpoint
│   │   │       └── [id]/
│   │   │           └── progress/
│   │   │               └── route.ts      # Progress update API
│   │   └── admin/
│   │       └── print-queue/
│   │           ├── page.tsx              # List view with SSE
│   │           └── [id]/
│   │               └── page.tsx          # Detail view with SSE
│   └── ...
└── prisma/
    ├── schema.prisma                     # Updated with progress fields
    └── migrations/
        └── 20251007224908_add_print_progress_fields/
            └── migration.sql
```

## Future Enhancements

### Filename Correlation
Currently, the Electron client finds matching print jobs by looking for active prints in the local state. Future improvements could:

1. **Store Print Filename in Database:**
   - Add `PrintFileName` field to PrintQueue schema
   - Store filename when print starts
   - Use exact filename matching in progress API

2. **Smart Correlation:**
   - Parse filename to extract job identifiers
   - Match by customer ID, geometry name, or timestamps
   - Handle multiple prints of same file

3. **Printer Job ID Tracking:**
   - Store Bambu printer's job ID
   - Query printer for job-specific progress
   - Match by unique job identifier

### WebSocket Alternative
If full bidirectional communication is needed in the future:

1. **Standalone WebSocket Server:**
   - Run separate WebSocket server alongside Next.js
   - Use Redis for pub/sub between Next.js API and WS server
   - More complex but supports true bidirectional communication

2. **Socket.io Integration:**
   - Add Socket.io to Next.js custom server
   - Provides rooms, namespaces, and automatic fallbacks
   - Better for complex real-time features

### Progress Reporting Enhancements

1. **Time Remaining Calculation:**
   - Track progress over time
   - Calculate estimated completion time
   - Show "Estimated time remaining: Xh Ym"

2. **Progress History:**
   - Store progress snapshots
   - Display progress graph/chart
   - Detect stalled prints (no progress update for X minutes)

3. **Print Alerts:**
   - Send notifications when print completes
   - Alert on print failures or stalls
   - Email/SMS notifications for long prints

## Testing

### Manual Testing Checklist

**Print Queue List Page:**
- [ ] SSE connects on page load
- [ ] Progress updates appear in real-time
- [ ] Progress badge shows percentage
- [ ] "Updated Xm ago" displays correctly
- [ ] Printer status banner shows (Electron only)
- [ ] Progress sent to server (Electron only)

**Print Queue Detail Page:**
- [ ] SSE connects on page load
- [ ] Progress bar updates in real-time
- [ ] Percentage displays correctly
- [ ] Last update timestamp shows with colors
- [ ] "Waiting for updates" shows when no data

**API Endpoints:**
- [ ] SSE endpoint accepts connections
- [ ] Heartbeats keep connection alive
- [ ] Progress API accepts updates
- [ ] Progress API validates input
- [ ] Broadcasts work correctly

### Debugging Tips

**SSE Connection Issues:**
```javascript
// In browser console:
const es = new EventSource('/api/print-queue/events');
es.onmessage = (e) => console.log('Message:', e.data);
es.onerror = (e) => console.error('Error:', e);
```

**Progress Update Issues:**
```javascript
// Test progress update:
await fetch('/api/print-queue/{id}/progress', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ progress: 50.5 })
});
```

**Database Query:**
```sql
-- Check progress in database:
SELECT id, progress, progressLastReportTime 
FROM PrintQueue 
WHERE PrintStartedTime IS NOT NULL 
AND PrintCompletedTime IS NULL;
```

## Notes

- SSE connections are automatically cleaned up when clients disconnect
- Progress updates are throttled by the 5-second polling interval
- Multiple clients can watch the same print job simultaneously
- Progress is persisted to database, survives server restarts
- Electron client is the source of truth for printer status

