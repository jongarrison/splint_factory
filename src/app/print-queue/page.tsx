'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';
import PrinterStatusBanner from '@/components/printer/PrinterStatusBanner';
import PrintAcceptanceModal from '@/components/PrintAcceptanceModal';
import DeletePrintModal from '@/components/DeletePrintModal';
import PrintConfirmModal from '@/components/PrintConfirmModal';
import DeviceAuthOverlay from '@/components/DeviceAuthOverlay';
import { useSmartPolling } from '@/hooks/useSmartPolling';

interface PrintQueueEntry {
  id: string;
  createdAt: string;
  meshFileName?: string;
  printFileName?: string;
  printStartedAt?: string;
  printCompletedAt?: string;
  isPrintSuccessful: boolean;
  printNote?: string;
  printAcceptance?: string | null;
  hasGeometryFile: boolean;
  hasPrintFile: boolean;
  progress?: number | null;
  progressLastReportAt?: string | null;
  designJob: {
    id: string;
    objectId?: string;
    createdAt: string;
    jobNote?: string;
    jobLabel?: string;
    design: {
      name: string;
      algorithmName: string;
    };
    creator: {
      id: string;
      name: string;
      email: string;
    };
    owningOrganization: {
      name: string;
    };
  };
}

export default function PrintQueuePage() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const [isElectronClient, setIsElectronClient] = useState(false);
  const [printingJobId, setPrintingJobId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [acceptanceModal, setAcceptanceModal] = useState<{
    printId: string;
    geometryName: string;
  } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    printId: string;
    geometryName: string;
    printStarted: boolean;
  } | null>(null);
  const [printConfirmModal, setPrintConfirmModal] = useState<{
    entry: PrintQueueEntry;
  } | null>(null);

  // MQTT-based printer status (Electron only)
  const [printerBusy, setPrinterBusy] = useState(false);

  // Device auth state (Electron only)
  const [deviceLocked, setDeviceLocked] = useState(false);
  const [factoryUrl, setFactoryUrl] = useState('');
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [approvedChallengeId, setApprovedChallengeId] = useState<string | null>(null);
  const [approvedUserName, setApprovedUserName] = useState<string | null>(null);
  const [screenLockTimeoutMs, setScreenLockTimeoutMs] = useState<number | null>(null);

  // Fetch org screen lock timeout from server
  const fetchOrgTimeout = useCallback(() => {
    if (!session?.user?.organizationId) return;
    fetch(`/api/organizations/${session.user.organizationId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const minutes = data?.screenLockTimeoutMinutes ?? 1;
        setScreenLockTimeoutMs(minutes * 60_000);
      })
      .catch(err => console.error('Failed to fetch org settings:', err));
  }, [session?.user?.organizationId]);

  // Stable callback for lock state changes - re-fetches timeout on unlock
  const handleLockStateChange = useCallback((locked: boolean) => {
    setDeviceLocked(locked);
    if (!locked) fetchOrgTimeout();
  }, [fetchOrgTimeout]);

  // Callback for processing device auth headers from poll responses
  const handleResponseHeaders = useCallback((headers: Headers) => {
    const authStatus = headers.get('x-device-auth-status');
    if (authStatus === 'challenge-approved') {
      setApprovedChallengeId(headers.get('x-device-auth-challenge-id'));
      setApprovedUserName(headers.get('x-device-auth-user'));
    }
  }, []);
  
  // Use smart polling hook for real-time updates
  const { 
    data: printQueue, 
    isLoading: loading, 
    error: fetchError,
    lastUpdate,
    refresh: refreshPrintQueue,
    isFetching
  } = useSmartPolling<PrintQueueEntry[]>('/api/print-queue', {
    enabled: !!session?.user,
    onResponseHeaders: handleResponseHeaders
  });
  
  const error = fetchError;
  
  // Notification system for print progress updates
  const [notification, setNotification] = useState<{
    message: string;
    type: 'info' | 'success' | 'error';
  } | null>(null);
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Show notification with auto-dismiss (minimum 3 seconds, new notifications clear old ones immediately)
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info', duration: number | null = 3000) => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    
    setNotification({ message, type });
    
    // If duration is null, keep the message displayed indefinitely
    if (duration !== null) {
      notificationTimeoutRef.current = setTimeout(() => {
        setNotification(null);
        notificationTimeoutRef.current = null;
      }, duration);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Detect if running in Electron client
    const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
    setIsElectronClient(isElectron);
    
    // Subscribe to print status updates if in Electron
    if (isElectron) {
      const electronAPI = (window as any).electronAPI;
      
      const unsubscribePrintStatus = electronAPI.printer.subscribeToPrintStatus((statusUpdate: {
        stage: string;
        message: string;
        amsStatus?: number;
        nozzleTemp?: number;
        targetTemp?: number;
        critical?: boolean;
      }) => {
        // Show the status update as a notification
        // Error messages stay displayed indefinitely until replaced by another message
        // Normal status messages auto-dismiss after 20 seconds
        const duration = statusUpdate.stage === 'error' ? null : 20000;
        const type = statusUpdate.stage === 'error' ? 'error' : 'info';
        showNotification(statusUpdate.message, type, duration);
      });

      // Subscribe to MQTT printer status to know if printer is physically busy
      const unsubscribePrinterStatus = electronAPI.printer.subscribeToStatus((status: {
        printJob: { active: boolean };
      }) => {
        setPrinterBusy(status.printJob.active);
      });
      
      // Cleanup subscriptions on unmount
      return () => {
        unsubscribePrintStatus();
        unsubscribePrinterStatus();
      };
    }
  }, []);

  // Initialize device auth state when running in Electron
  useEffect(() => {
    if (!isElectronClient) return;
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.getEnvironmentInfo) return;

    (async () => {
      try {
        const envInfo = await electronAPI.getEnvironmentInfo();
        if (envInfo.deviceId) {
          setDeviceId(envInfo.deviceId);
        }
        // Use the FACTORY_URL from Electron env so QR codes have the network-visible hostname
        setFactoryUrl(envInfo.factoryUrl || window.location.origin);
      } catch (err) {
        console.error('Failed to get device environment info:', err);
      }
    })();
  }, [isElectronClient]);

  // Register device with the server when we have deviceId + session
  useEffect(() => {
    if (!deviceId || !session?.user) return;

    fetch('/api/client-devices/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        name: `Splint Client (${deviceId.substring(0, 8)})`,
      }),
    }).catch(err => console.error('Device registration failed:', err));
  }, [deviceId, session]);

  // Fetch org screen lock timeout on mount
  useEffect(() => {
    fetchOrgTimeout();
  }, [fetchOrgTimeout]);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user) {
      router.push('/login');
      return;
    }
  }, [session, status, router]);



  const isActivePrint = (entry: PrintQueueEntry) => {
    // A print is active if it hasn't been accepted, rejected, or failed
    if (entry.printAcceptance !== null) return false; // Accepted or rejected
    if (entry.printCompletedAt && !entry.isPrintSuccessful) return false; // Failed
    return true; // Otherwise active
  };

  const filteredPrintQueue = printQueue
    ?.filter(entry => 
      viewMode === 'active' ? isActivePrint(entry) : !isActivePrint(entry)
    )
    .sort((a, b) => {
      // Get creation times
      const timeA = new Date(a.designJob.createdAt).getTime();
      const timeB = new Date(b.designJob.createdAt).getTime();
      
      if (viewMode === 'active') {
        // Active: oldest first (ascending)
        return timeA - timeB;
      } else {
        // History: newest first (descending)
        return timeB - timeA;
      }
    });

  const getStatusBadge = (entry: PrintQueueEntry) => {
    if (entry.printCompletedAt && entry.isPrintSuccessful) {
      return <span className="status-badge status-success">Print Successful</span>;
    }
    if (entry.printCompletedAt && !entry.isPrintSuccessful) {
      return <span className="status-badge status-error">Print Failed</span>;
    }
    if (entry.printStartedAt) {
      const progressText = entry.progress != null ? ` ${entry.progress.toFixed(1)}%` : '';
      return <span className="status-badge status-warning">Printing{progressText && <span className="progress-percentage">{progressText}</span>}</span>;
    }
    return <span className="status-badge status-pending">Ready to Print</span>;
  };

  const getAcceptanceBadge = (entry: PrintQueueEntry) => {
    if (entry.printAcceptance === 'ACCEPTED') {
      return <span className="status-badge status-success">Accepted</span>;
    }
    if (entry.printAcceptance === 'REJECT_DESIGN') {
      return <span className="status-badge status-warning">Rejected - Design</span>;
    }
    if (entry.printAcceptance === 'REJECT_PRINT') {
      return <span className="status-badge status-error">Rejected - Print</span>;
    }
    if (entry.printAcceptance === 'REJECTED') {
      return <span className="status-badge status-error">Rejected</span>;
    }
    return null;
  };
  
  const getProgressInfo = (entry: PrintQueueEntry) => {
    if (!entry.printStartedAt || entry.printCompletedAt) {
      return null;
    }
    
    if (entry.progressLastReportAt) {
      const lastUpdate = new Date(entry.progressLastReportAt);
      const minutesAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 60000);
      
      if (minutesAgo < 1) {
        return <span className="last-updated-time text-xs text-muted">Updated just now</span>;
      } else if (minutesAgo < 60) {
        return <span className="last-updated-time text-xs text-muted">Updated <span className="time-value">{minutesAgo}</span>m ago</span>;
      } else {
        const hoursAgo = Math.floor(minutesAgo / 60);
        return <span className="last-updated-time text-xs text-muted">Updated <span className="time-value">{hoursAgo}</span>h ago</span>;
      }
    }
    
    return null;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleMarkPrintSuccessful = async (entryId: string) => {
    try {
      const response = await fetch(`/api/print-queue/${entryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isPrintSuccessful: true,
          printCompletedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update print status');
      }

      // Refresh the list
      refreshPrintQueue();
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Failed to update print status', 'error');
    }
  };

  const handleStartPrint = async (entryId: string) => {
    try {
      const response = await fetch(`/api/print-queue/${entryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          printStartedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start print');
      }

      // Refresh the list
      refreshPrintQueue();
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Failed to start print', 'error');
    }
  };

  const handlePrint = async (entry: PrintQueueEntry, runCalibration: boolean) => {
    if (!isElectronClient) {
      showNotification('Printing is only available in the Electron client', 'error');
      return;
    }

    try {
      setPrintingJobId(entry.id);

      // Step 1: Downloading file
      showNotification('📥 Downloading print file from server...', 'info');

      // Get the print queue ID and geometry processing queue ID
      const printQueueId = entry.id;
      const geometryJobId = entry.designJob.id;
      
      // Get session cookie for authentication
      const sessionCookie = document.cookie;
      
      // Generate a job name from the geometry and customer info
      const jobName = `${entry.designJob.design.name.replace(/\s+/g, '_')}_${entry.designJob.jobLabel || 'job'}`;

      // Step 2: Uploading to printer
      showNotification('📤 Uploading file to printer...', 'info');

      // Call the Electron API to print
      const electronAPI = (window as any).electronAPI;
      const result = await electronAPI.printing.printGeometryJob(
        printQueueId,
        geometryJobId,
        sessionCookie,
        jobName,
        { runCalibration }
      );

      if (!result.success) {
        throw new Error(result.error || 'Print failed');
      }

      // Step 3: Loading filament
      showNotification('🧵 Loading filament from AMS...', 'info');

      // Step 4: Starting print
      showNotification('🖨️ Sending print command to printer...', 'info');

      // Update the print queue entry to mark as started
      await fetch(`/api/print-queue/${entry.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          printStartedAt: new Date().toISOString(),
        }),
      });

      // Refresh the list
      await refreshPrintQueue();
      
      // Success notification (stays longer - 5 seconds)
      showNotification(`✅ Print started: ${entry.designJob.design.name}`, 'success', 5000);
    } catch (err) {
      // Show error notification instead of setting error state
      showNotification(
        `❌ Print failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
        5000
      );
      console.error('Print error:', err);
    } finally {
      setPrintingJobId(null);
    }
  };

  const handleDeleteSubmit = async (printId: string, action: 'DELETE' | 'REJECT_DESIGN' | 'REJECT_PRINT') => {
    try {
      // If rejecting design or print, record that before disabling
      if (action === 'REJECT_DESIGN' || action === 'REJECT_PRINT') {
        const acceptanceResponse = await fetch(`/api/print-queue/${printId}/acceptance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ printAcceptance: action }),
        });
        if (!acceptanceResponse.ok) {
          throw new Error(action === 'REJECT_DESIGN' ? 'Failed to record design rejection' : 'Failed to record print rejection');
        }
      }

      const response = await fetch(`/api/print-queue/${printId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: false }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete print job');
      }

      refreshPrintQueue();
      const msg = action === 'REJECT_DESIGN' ? 'Design rejected and removed' : action === 'REJECT_PRINT' ? 'Print rejected and removed' : 'Print job removed';
      showNotification(msg, 'success', 3000);
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Failed to delete print job', 'error');
      throw err;
    }
  };

  // Device auth handlers
  const handleCreateChallenge = useCallback(async () => {
    if (!deviceId) return null;
    try {
      const res = await fetch('/api/client-auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
      if (!res.ok) return null;
      return res.json();
    } catch (err) {
      console.error('[PrintQueue] Challenge creation failed:', err);
      return null;
    }
  }, [deviceId]);

  const handleExchangeSession = useCallback(async (challengeId: string) => {
    console.log('[PrintQueue] handleExchangeSession called with:', challengeId, 'deviceId:', deviceId);
    if (!deviceId) throw new Error('No device ID available');
    const res = await fetch('/api/client-auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, deviceId }),
    });
    console.log('[PrintQueue] Exchange response status:', res.status);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[PrintQueue] Exchange failed:', res.status, body);
      return false;
    }
    // Tell NextAuth to re-read the session cookie, then refresh data
    // Non-critical -- cookie is already set even if this fails
    try { await updateSession(); } catch (e) { console.warn('[PrintQueue] updateSession failed (non-critical):', e); }
    console.log('[PrintQueue] Exchange succeeded, refreshing print queue');
    refreshPrintQueue();
    return true;
  }, [deviceId, refreshPrintQueue]);

  const handleAcceptanceSubmit = async (printId: string, acceptance: string, note: string) => {
    try {
      const response = await fetch(`/api/print-queue/${printId}/acceptance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          printAcceptance: acceptance,
          printNote: note || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update print acceptance');
      }

      // Refresh the list
      await refreshPrintQueue();
      const label = acceptance === 'ACCEPTED' ? 'accepted' : 'rejected';
      showNotification(
        `Print ${label}`,
        'success',
        3000
      );
    } catch (err) {
      showNotification(
        err instanceof Error ? err.message : 'Failed to update print acceptance',
        'error',
        5000
      );
      throw err; // Re-throw so modal knows to handle error
    }
  };

  if (status === 'loading' || (loading && !printQueue)) {
    return (
      <div className="page-shell" data-testid="print-queue-loading">
        <Header variant={isElectronClient ? 'electron' : 'browser'} />
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-blue)] mx-auto"></div>
            <p className="mt-2 text-sm text-secondary">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell" data-testid="print-queue-page">
      <Header variant={isElectronClient ? 'electron' : 'browser'} />
      
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-4">
        <div className="mb-2 sm:mb-4">
          <h1 className="page-title">Print Queue</h1>
        </div>

        {/* Printer Status Banner (only visible in Electron) */}
        <PrinterStatusBanner />

        {/* Print Progress Notification */}
        {notification && (
          <div 
            className={`mb-2 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between animate-slide-down shadow-lg ${
              notification.type === 'success' 
                ? 'banner-success' 
                : notification.type === 'error'
                ? 'banner-error'
                : 'banner-info'
            }`}
            data-testid="notification-banner"
          >
            <span className="flex items-center gap-2">
              {notification.type === 'info' && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {notification.message}
            </span>
            <button 
              onClick={() => {
                setNotification(null);
                if (notificationTimeoutRef.current) {
                  clearTimeout(notificationTimeoutRef.current);
                }
              }}
              className={`ml-3 hover:opacity-70 transition-opacity ${
                notification.type === 'success' ? 'text-[var(--status-success-text)]' :
                notification.type === 'error' ? 'text-[var(--status-error-text)]' : 'text-[var(--accent-blue)]'
              }`}
              title="Dismiss"
              data-testid="dismiss-notification-btn"
            >
              ✕
            </button>
          </div>
        )}

        {/* Error messages (separate from notifications) */}
        {error && (
          <div className="alert-error text-sm mb-2" data-testid="alert-error">
            {error}
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-base font-medium text-primary">Print Jobs</h2>
              <div className="flex items-center gap-2">
                {lastUpdate && (
                  <span className="text-xs text-muted">
                    Updated {lastUpdate.toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={refreshPrintQueue}
                  disabled={isFetching}
                  className="btn-neutral text-sm"
                  title="Refresh print queue"
                  data-testid="refresh-btn"
                >
                  <svg 
                    className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                    />
                  </svg>
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>
            
            {/* Active / History Toggle */}
            <div className="flex gap-1 p-1 bg-[var(--surface-secondary)] rounded-lg w-fit">
              <button
                onClick={() => setViewMode('active')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'active'
                    ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                    : 'bg-[var(--surface)] text-secondary'
                }`}
                data-testid="view-mode-active-btn"
              >
                Active
              </button>
              <button
                onClick={() => setViewMode('history')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'history'
                    ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                    : 'bg-[var(--surface)] text-secondary'
                }`}
                data-testid="view-mode-history-btn"
              >
                History
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            {!filteredPrintQueue || filteredPrintQueue.length === 0 ? (
              <div className="text-center py-8">
                  <div className="text-secondary text-base">
                    {viewMode === 'active' ? 'No active print jobs' : 'No print history'}
                  </div>
                  <p className="text-muted mt-1 text-sm">
                  {viewMode === 'active' 
                    ? 'Jobs appear after processing.' 
                    : 'Completed, accepted, and rejected prints appear here.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table" data-testid="print-queue-table">
                  <thead>
                    <tr>
                      <th className="px-2 py-2">
                        Actions
                      </th>
                      <th className="px-2 py-2">
                        Info
                      </th>
                      <th className="px-2 py-2">
                        Job
                      </th>
                      <th className="px-2 py-2">
                        Status
                      </th>
                      <th className="px-2 py-2 hidden lg:table-cell">
                        Progress
                      </th>
                      <th className="px-2 py-2 text-center w-12">
                        {/* Delete column */}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrintQueue.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <div className="flex flex-row sm:flex-col gap-1">
                            {/* Print button - shows for all users but only enabled in Electron client */}
                            {!entry.printStartedAt && entry.hasPrintFile && (
                          <button
                                onClick={() => isElectronClient && !printerBusy ? setPrintConfirmModal({ entry }) : null}
                                disabled={!isElectronClient || printingJobId === entry.id || printerBusy}
                                className="btn-alt px-4 py-1.5 text-sm font-semibold min-w-[80px] inline-flex items-center justify-center gap-1"
                                data-testid="print-btn"
                              >
                                {printingJobId === entry.id ? (
                                  <>
                                    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Sending
                                  </>
                                ) : printerBusy ? (
                                  'Printer Busy'
                                ) : (
                                  <>
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                                    </svg>
                                    Print
                                  </>
                                )}
                              </button>
                            )}
                            
                            {entry.printCompletedAt && !entry.isPrintSuccessful && (
                              <button
                                onClick={() => handleMarkPrintSuccessful(entry.id)}
                                className="btn-success px-2 py-1 text-xs min-w-[60px]"
                                data-testid="mark-done-btn"
                              >
                                Done
                              </button>
                            )}
                            
                            {/* Review button - show for completed prints that haven't been reviewed */}
                            {entry.progress != null && entry.progress > 99 && entry.printAcceptance === null && (
                                <button
                                  onClick={() => setAcceptanceModal({
                                    printId: entry.id,
                                    geometryName: entry.designJob.design.name,
                                  })}
                                  className="btn-primary px-4 py-1.5 text-sm font-semibold min-w-[80px]"
                                  title="Review print quality"
                                  data-testid="review-print-btn"
                                >
                                  Review Print
                                </button>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <div className="text-xs text-muted">Object:</div>
                          <div className="text-sm font-mono font-semibold text-link">
                            {entry.designJob.objectId || 'N/A'}
                          </div>
                          <div className="text-xs text-muted mt-1">Job:</div>
                          <div className="text-sm text-primary">
                            {entry.designJob.jobLabel || 'N/A'}
                          </div>
                          {entry.designJob.jobNote && (
                            <div className="text-xs text-muted truncate max-w-[150px] mt-1">
                              {entry.designJob.jobNote}
                            </div>
                          )}
                          <div className="text-xs text-muted mt-1">
                            {formatDate(entry.createdAt)}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <Link href={`/print-queue/${entry.id}`} className="block group">
                            <div className="geometry-name text-sm font-medium text-primary truncate max-w-[200px] group-hover:text-[var(--accent-blue)] transition-colors">
                              {entry.designJob.design.name}
                            </div>
                          </Link>
                          {entry.designJob.creator?.name && (
                            <div className="text-xs text-muted mt-0.5">
                              {entry.designJob.creator.name}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <div className="print-status flex flex-wrap gap-2">
                            {getStatusBadge(entry)}
                            {getAcceptanceBadge(entry)}
                          </div>
                          {entry.printStartedAt && (
                            <div className="print-started-time text-xs text-muted mt-1 hidden sm:block">
                              {formatDate(entry.printStartedAt)}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 hidden lg:table-cell">
                          {entry.progress != null ? (
                            <div className="progress-info">
                              <div className="progress-percentage text-sm font-semibold text-primary">
                                {entry.progress.toFixed(1)}%
                              </div>
                              {entry.progressLastReportAt && (
                                <div className="last-updated-time text-xs text-muted mt-0.5">
                                  {(() => {
                                    const lastUpdate = new Date(entry.progressLastReportAt);
                                    const minutesAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 60000);
                                    
                                    if (minutesAgo < 1) {
                                      return 'just now';
                                    } else if (minutesAgo < 60) {
                                      return `${minutesAgo}m ago`;
                                    } else {
                                      const hoursAgo = Math.floor(minutesAgo / 60);
                                      return `${hoursAgo}h ago`;
                                    }
                                  })()}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => setDeleteModal({
                              printId: entry.id,
                              geometryName: entry.designJob.design.name,
                              printStarted: !!entry.printStartedAt,
                            })}
                            className="action-delete w-10 h-10"
                            title="Delete print job"
                            data-testid="delete-btn"
                          >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                    </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Print Acceptance Modal */}
      {acceptanceModal && (
        <PrintAcceptanceModal
          printId={acceptanceModal.printId}
          geometryName={acceptanceModal.geometryName}
          onClose={() => setAcceptanceModal(null)}
          onSubmit={handleAcceptanceSubmit}
        />
      )}

      {/* Print Confirm Modal */}
      {printConfirmModal && (
        <PrintConfirmModal
          geometryName={printConfirmModal.entry.designJob.design.name}
          onClose={() => setPrintConfirmModal(null)}
          onConfirm={(runCalibration) => {
            const entry = printConfirmModal.entry;
            setPrintConfirmModal(null);
            handlePrint(entry, runCalibration);
          }}
        />
      )}

      {/* Delete Print Modal */}
      {deleteModal && (
        <DeletePrintModal
          printId={deleteModal.printId}
          geometryName={deleteModal.geometryName}
          printStarted={deleteModal.printStarted}
          onClose={() => setDeleteModal(null)}
          onSubmit={handleDeleteSubmit}
        />
      )}

      {/* Device Auth Overlay (Electron only) */}
      {isElectronClient && deviceId && screenLockTimeoutMs !== null && (
        <DeviceAuthOverlay
          factoryUrl={factoryUrl}
          deviceId={deviceId}
          onCreateChallenge={handleCreateChallenge}
          onExchangeSession={handleExchangeSession}
          onRefreshPoll={refreshPrintQueue}
          approvedChallengeId={approvedChallengeId}
          approvedUserName={approvedUserName}
          inactivityTimeout={screenLockTimeoutMs}
          onLockStateChange={handleLockStateChange}
        />
      )}
    </div>
  );
}