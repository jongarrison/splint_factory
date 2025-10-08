# Real-Time Print Progress - Testing Guide

## Overview
This guide provides step-by-step instructions for testing the complete real-time print progress tracking system.

## Prerequisites

### 1. Database Setup
The database must have the progress tracking fields. Verify with:
```bash
cd splint_factory
sqlite3 prisma/dev.db "PRAGMA table_info(PrintQueue);" | grep progress
```

Expected output:
```
8|progress|REAL|0||0
9|progressLastReportTime|DATETIME|0||0
```

### 2. Printer Configuration (Electron Client Only)
The Raspberry Pi Electron client must have a printer configured:
- IP address
- Access code
- Model (P1S, P1P, X1C, etc.)

## Testing Scenarios

### Scenario 1: SSE Connection (Any Browser)

**Objective:** Verify that clients can connect to the SSE endpoint and receive updates.

**Steps:**
1. Open browser and navigate to Print Queue page (`/admin/print-queue`)
2. Open browser DevTools (F12) → Console tab
3. Look for EventSource connection messages

**Expected Results:**
- No connection errors in console
- SSE connection established (check Network tab → `events` endpoint with status 200)
- Heartbeat messages received every 30 seconds

**Manual Test:**
```javascript
// In browser console:
const es = new EventSource('/api/print-queue/events');
es.onopen = () => console.log('✅ Connected to SSE');
es.onmessage = (e) => console.log('📨 Message:', e.data);
es.onerror = (e) => console.error('❌ Error:', e);
```

### Scenario 2: Progress Display (No Active Print)

**Objective:** Verify UI displays correctly when no prints are active.

**Steps:**
1. Navigate to Print Queue page
2. View list of print jobs
3. Open detail page for a job that hasn't started

**Expected Results:**
- Jobs without `PrintStartedTime` show "Ready to Print" badge
- No progress bar displayed
- No "Updated X ago" messages

### Scenario 3: Manual Progress Update (Browser/Postman)

**Objective:** Test the progress update API endpoint and SSE broadcast.

**Setup:**
1. Create or find a print job with `PrintStartedTime` set
2. Note the job ID

**Test with cURL:**
```bash
# Get a job ID from the database
JOB_ID=$(sqlite3 splint_factory/prisma/dev.db "SELECT id FROM PrintQueue WHERE PrintStartedTime IS NOT NULL LIMIT 1;")

echo "Testing job: $JOB_ID"

# Send progress update (must be authenticated)
curl -X PUT http://localhost:3000/api/print-queue/$JOB_ID/progress \
  -H "Content-Type: application/json" \
  -H "Cookie: $(cat cookies.txt)" \
  -d '{"progress": 45.5}'
```

**Test with Browser Console:**
```javascript
// On the Print Queue page:
const jobId = 'YOUR_JOB_ID_HERE';

await fetch(`/api/print-queue/${jobId}/progress`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ progress: 67.3 })
});
```

**Expected Results:**
- API returns `{ "success": true, "id": "...", "progress": 67.3 }`
- Database updated: `SELECT progress, progressLastReportTime FROM PrintQueue WHERE id='YOUR_ID';`
- SSE broadcasts update to all connected clients
- UI updates automatically without refresh:
  - Status badge shows "Printing 67.3%"
  - Progress bar moves to 67.3%
  - "Updated just now" appears below status
  - After 1+ minute: "Updated Xm ago"

### Scenario 4: Printer Status Polling (Electron Client Only)

**Objective:** Test Electron client's ability to query printer and send updates.

**Prerequisites:**
- Raspberry Pi with Electron client running
- Bambu printer powered on and connected to network
- Printer configured in Electron client

**Steps:**
1. Start a print job on the Bambu printer (can be any file)
2. Navigate to Print Queue page in Electron client
3. Open Electron DevTools (if available) to see console logs

**Expected Results:**
- Console shows "Received printer state update" every 5 seconds
- If print is active:
  - Blue banner appears at top: "Printer Active"
  - Shows filename, progress %, time remaining
  - Progress updates sent to server every 5 seconds
- Other clients viewing same page see updates in real-time

**Manual Test (Electron Console):**
```javascript
// Test the printer status API:
const status = await window.electronAPI.printer.getStatus();
console.log('Printer Status:', status);

// Expected when printing:
// {
//   isActive: true,
//   filename: "some_file.3mf",
//   progress: 45.3,
//   timeRemaining: 127,
//   state: "RUNNING"
// }

// Expected when idle:
// {
//   isActive: false
// }
```

### Scenario 5: Multi-Client Real-Time Updates

**Objective:** Verify multiple clients receive updates simultaneously.

**Setup:**
1. Open Print Queue page in 2+ browser windows/tabs
2. Keep both visible side-by-side

**Test:**
1. In one browser console, send a progress update (see Scenario 3)
2. Watch both windows simultaneously

**Expected Results:**
- Both windows update instantly (within ~100ms)
- No page refresh needed
- Progress bar animates smoothly
- Timestamp updates to "Updated just now"

### Scenario 6: Detail Page Real-Time Updates

**Objective:** Test progress display on individual job detail page.

**Steps:**
1. Navigate to a specific print job detail page
2. Send progress updates via API or Electron client
3. Watch progress bar and timestamp update

**Expected Results:**
- Full-width progress bar shows percentage
- Percentage text updates: "45.3%"
- Last update time shows with color coding:
  - Green "(just now)" - < 1 minute
  - Gray "(Xm ago)" - < 1 hour  
  - Orange "(Xh ago)" - > 1 hour
- Updates appear without page refresh

### Scenario 7: Connection Recovery

**Objective:** Test SSE reconnection after network interruption.

**Steps:**
1. Open Print Queue page
2. Open DevTools → Network tab
3. Verify `events` endpoint is connected
4. Disable network (DevTools → Network → Offline)
5. Wait 5 seconds
6. Re-enable network

**Expected Results:**
- SSE connection closes when network lost
- After 5 seconds, client automatically reconnects
- Connection re-established, updates resume
- Console shows reconnection attempt

### Scenario 8: Full End-to-End (Electron Client)

**Objective:** Complete workflow from print start to completion.

**Steps:**
1. Create a geometry job in splint_factory
2. Create a print queue entry for that job
3. Download and cache the 3MF file (if available)
4. Start print on Bambu printer
5. Mark print as started in database:
   ```sql
   UPDATE PrintQueue 
   SET PrintStartedTime = datetime('now')
   WHERE id = 'YOUR_JOB_ID';
   ```
6. Watch Print Queue page in both Electron and browser

**Expected Results:**
- Electron client detects active print
- Progress updates sent to server every 5 seconds
- Browser clients see real-time progress
- Progress bar moves smoothly
- Time remaining updates
- Filename displays correctly
- After print completes:
  - Progress reaches 100%
  - "Mark Successful" button appears
  - Clicking marks print as complete

## Debugging

### Check SSE Connection
```javascript
// Browser console
const es = new EventSource('/api/print-queue/events');
es.onmessage = (e) => {
  try {
    const data = JSON.parse(e.data);
    console.log('SSE Message:', data);
  } catch (err) {
    console.log('SSE Heartbeat or comment');
  }
};
```

### Check Database State
```bash
# View all active prints
sqlite3 splint_factory/prisma/dev.db "
SELECT 
  id,
  PrintStartedTime,
  progress,
  progressLastReportTime,
  PrintCompletedTime
FROM PrintQueue 
WHERE PrintStartedTime IS NOT NULL
ORDER BY PrintStartedTime DESC
LIMIT 5;
"
```

### Check API Endpoint
```bash
# Test authentication
curl -v http://localhost:3000/api/print-queue/events \
  -H "Cookie: $(cat cookies.txt)"
```

### Electron Console Logs
```javascript
// Check if electronAPI is available
console.log('Electron API available:', !!window.electronAPI);

// Check printer API
console.log('Printer API available:', !!window.electronAPI?.printer);

// Test printer status
window.electronAPI.printer.getStatus()
  .then(status => console.log('Status:', status))
  .catch(err => console.error('Error:', err));
```

### Network Tab Analysis
1. Open DevTools → Network tab
2. Filter by "events"
3. Look for:
   - Status: 200
   - Type: text/event-stream
   - Time: (pending) - indicates persistent connection
4. Click on the request to see messages

## Common Issues

### Issue: SSE Not Connecting
**Symptoms:** No events received, connection closes immediately
**Causes:**
- Authentication failed (no session cookie)
- Server not running
- CORS issues (if accessing from different domain)

**Solutions:**
- Verify logged in (check session cookie in DevTools → Application)
- Check Next.js dev server is running: `npm run dev`
- Access from same domain as API

### Issue: Progress Not Updating
**Symptoms:** SSE connected but no progress updates
**Causes:**
- No active prints
- Progress API not being called
- Electron client not configured

**Solutions:**
- Verify print job has PrintStartedTime set
- Check Electron console for API call logs
- Verify printer is configured and connected

### Issue: Electron API Not Available
**Symptoms:** `window.electronAPI` is undefined
**Causes:**
- Not running in Electron client
- Preload script not loaded

**Solutions:**
- Verify running in Electron (not browser)
- Check Electron console for preload errors
- Restart Electron client

### Issue: Printer Connection Timeout
**Symptoms:** "Connection timeout" in printer status
**Causes:**
- Printer offline or powered off
- Wrong IP address
- Network issues
- Printer busy/unresponsive

**Solutions:**
- Verify printer is on and connected to network
- Ping printer: `ping 192.168.1.XXX`
- Check printer IP hasn't changed
- Try accessing printer web interface
- Wait and retry (printer may be busy)

## Performance Benchmarks

**Expected Latency:**
- Electron → Server: < 100ms (local network)
- Server → All Clients: < 50ms (SSE broadcast)
- End-to-End: < 150ms (print progress to UI update)

**Resource Usage:**
- SSE Connection: ~1KB/min (heartbeats only)
- Progress Update: ~500 bytes per update
- Client Memory: +5-10MB per open connection

**Polling Intervals:**
- Electron printer status: Every 5 seconds
- SSE heartbeat: Every 30 seconds
- Browser typically doesn't poll (uses SSE only)

## Success Criteria

✅ **All tests pass if:**
1. SSE connects without errors
2. Progress updates appear in real-time (<1 second delay)
3. Multiple clients update simultaneously
4. UI renders correctly at all stages
5. Connection recovers after interruption
6. Electron client successfully queries printer
7. No memory leaks after 1+ hour
8. Database updates persist correctly

## Next Steps After Testing

If all tests pass:
1. ✅ Mark implementation complete
2. 📝 Document any configuration gotchas
3. 🎨 Consider UI polish (animations, notifications)
4. 📊 Add print history/analytics
5. 🔔 Implement completion notifications

If tests fail:
1. 🐛 Document failure mode
2. 📋 Check logs (browser + server + Electron)
3. 🔍 Review error messages
4. 💡 Consult debugging section above
5. 🛠️ Fix and re-test

