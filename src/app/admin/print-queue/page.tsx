'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';
import PrinterStatusBanner from '@/components/printer/PrinterStatusBanner';
import PrintAcceptanceModal from '@/components/PrintAcceptanceModal';
import { useSmartPolling } from '@/hooks/useSmartPolling';

interface PrintQueueEntry {
  id: string;
  GeometryFileName?: string;
  PrintFileName?: string;
  PrintStartedTime?: string;
  PrintCompletedTime?: string;
  isPrintSuccessful: boolean;
  printNote?: string;
  printAcceptance?: boolean | null;
  hasGeometryFile: boolean;
  hasPrintFile: boolean;
  progress?: number | null;
  progressLastReportTime?: string | null;
  geometryProcessingQueue: {
    id: string;
    objectID?: string;
    CreationTime: string;
    CustomerNote?: string;
    CustomerID?: string;
    geometry: {
      GeometryName: string;
      GeometryAlgorithmName: string;
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
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isElectronClient, setIsElectronClient] = useState(false);
  const [printingJobId, setPrintingJobId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [acceptanceModal, setAcceptanceModal] = useState<{
    printId: string;
    geometryName: string;
    isAccepting: boolean;
  } | null>(null);
  
  // Use smart polling hook for real-time updates
  const { 
    data: printQueue, 
    isLoading: loading, 
    error: fetchError,
    lastUpdate,
    refresh: refreshPrintQueue,
    isFetching
  } = useSmartPolling<PrintQueueEntry[]>('/api/print-queue', {
    enabled: !!session?.user
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
      
      const unsubscribe = electronAPI.printer.subscribeToPrintStatus((statusUpdate: {
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
      
      // Cleanup subscription on unmount
      return () => {
        unsubscribe();
      };
    }
  }, []);

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
    if (entry.PrintCompletedTime && !entry.isPrintSuccessful) return false; // Failed
    return true; // Otherwise active
  };

  const filteredPrintQueue = printQueue
    ?.filter(entry => 
      viewMode === 'active' ? isActivePrint(entry) : !isActivePrint(entry)
    )
    .sort((a, b) => {
      // Get creation times
      const timeA = new Date(a.geometryProcessingQueue.CreationTime).getTime();
      const timeB = new Date(b.geometryProcessingQueue.CreationTime).getTime();
      
      if (viewMode === 'active') {
        // Active: oldest first (ascending)
        return timeA - timeB;
      } else {
        // History: newest first (descending)
        return timeB - timeA;
      }
    });

  const getStatusBadge = (entry: PrintQueueEntry) => {
    if (entry.PrintCompletedTime && entry.isPrintSuccessful) {
      return <span className="status-badge status-completed px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Print Successful</span>;
    }
    if (entry.PrintCompletedTime && !entry.isPrintSuccessful) {
      return <span className="status-badge status-failed px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Print Failed</span>;
    }
    if (entry.PrintStartedTime) {
      const progressText = entry.progress != null ? ` ${entry.progress.toFixed(1)}%` : '';
      return <span className="status-badge status-printing px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Printing{progressText && <span className="progress-percentage">{progressText}</span>}</span>;
    }
    return <span className="status-badge status-ready px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Ready to Print</span>;
  };

  const getAcceptanceBadge = (entry: PrintQueueEntry) => {
    if (entry.printAcceptance === true) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-teal-100 text-teal-800">✓ Accepted</span>;
    }
    if (entry.printAcceptance === false) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800">✗ Rejected</span>;
    }
    return null;
  };
  
  const getProgressInfo = (entry: PrintQueueEntry) => {
    if (!entry.PrintStartedTime || entry.PrintCompletedTime) {
      return null;
    }
    
    if (entry.progressLastReportTime) {
      const lastUpdate = new Date(entry.progressLastReportTime);
      const minutesAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 60000);
      
      if (minutesAgo < 1) {
        return <span className="last-updated-time text-xs text-gray-500">Updated just now</span>;
      } else if (minutesAgo < 60) {
        return <span className="last-updated-time text-xs text-gray-500">Updated <span className="time-value">{minutesAgo}</span>m ago</span>;
      } else {
        const hoursAgo = Math.floor(minutesAgo / 60);
        return <span className="last-updated-time text-xs text-gray-500">Updated <span className="time-value">{hoursAgo}</span>h ago</span>;
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
          PrintCompletedTime: new Date().toISOString(),
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
          PrintStartedTime: new Date().toISOString(),
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

  const handlePrint = async (entry: PrintQueueEntry) => {
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
      const geometryJobId = entry.geometryProcessingQueue.id;
      
      // Get session cookie for authentication
      const sessionCookie = document.cookie;
      
      // Generate a job name from the geometry and customer info
      const jobName = `${entry.geometryProcessingQueue.geometry.GeometryName.replace(/\s+/g, '_')}_${entry.geometryProcessingQueue.CustomerID || 'customer'}`;

      // Step 2: Uploading to printer
      showNotification('📤 Uploading file to printer...', 'info');

      // Call the Electron API to print
      const electronAPI = (window as any).electronAPI;
      const result = await electronAPI.printing.printGeometryJob(
        printQueueId,
        geometryJobId,
        sessionCookie,
        jobName
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
          PrintStartedTime: new Date().toISOString(),
        }),
      });

      // Refresh the list
      await refreshPrintQueue();
      
      // Success notification (stays longer - 5 seconds)
      showNotification(`✅ Print started: ${entry.geometryProcessingQueue.geometry.GeometryName}`, 'success', 5000);
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

  const handleDelete = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this print job? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/print-queue/${entryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isEnabled: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete print job');
      }

      // Refresh the list (the deleted entry will be filtered out)
      refreshPrintQueue();
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Failed to delete print job', 'error');
    }
  };

  const handleAcceptanceSubmit = async (printId: string, acceptance: boolean, note: string) => {
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
      showNotification(
        acceptance ? '✅ Print accepted' : '❌ Print rejected',
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
      <div className="min-h-screen bg-gray-50">
        <Header variant={isElectronClient ? 'electron' : 'browser'} />
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header variant={isElectronClient ? 'electron' : 'browser'} />
      
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-4">
        <div className="mb-2 sm:mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Print Queue</h1>
        </div>

        {/* Printer Status Banner (only visible in Electron) */}
        <PrinterStatusBanner />

        {/* Print Progress Notification */}
        {notification && (
          <div 
            className={`mb-2 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between animate-slide-down shadow-lg ${
              notification.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-800' 
                : notification.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-700'
                : 'bg-blue-50 border border-blue-200 text-blue-800'
            }`}
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
                notification.type === 'success' ? 'text-green-600' :
                notification.type === 'error' ? 'text-red-600' : 'text-blue-600'
              }`}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Error messages (separate from notifications) */}
        {error && (
          <div className="mb-2 bg-red-50 border border-red-200 text-red-700 px-2 py-2 rounded text-sm">
            {error}
          </div>
        )}

        <div className="bg-white shadow rounded">
          <div className="px-2 py-2 border-b border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-base font-medium text-gray-900">Print Jobs</h2>
              <div className="flex items-center gap-2">
                {lastUpdate && (
                  <span className="text-xs text-gray-500">
                    Updated {lastUpdate.toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={refreshPrintQueue}
                  disabled={isFetching}
                  className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh print queue"
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
            <div className="flex gap-1 p-1 bg-gray-800 rounded-lg w-fit">
              <button
                onClick={() => setViewMode('active')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'active'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setViewMode('history')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'history'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                History
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            {!filteredPrintQueue || filteredPrintQueue.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500 text-base">
                  {viewMode === 'active' ? 'No active print jobs' : 'No print history'}
                </div>
                <p className="text-gray-400 mt-1 text-sm">
                  {viewMode === 'active' 
                    ? 'Jobs appear after processing.' 
                    : 'Completed, accepted, and rejected prints appear here.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        IDs
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                        Progress
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase w-12">
                        {/* Delete column */}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPrintQueue.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-2 py-2 whitespace-nowrap">
                          <div className="flex flex-row sm:flex-col gap-1">
                            {/* Print button - shows for all users but only enabled in Electron client */}
                            {!entry.PrintStartedTime && entry.hasPrintFile && (
                              <div className="relative group">
                                <button
                                  onClick={() => isElectronClient ? handlePrint(entry) : null}
                                  disabled={!isElectronClient || printingJobId === entry.id}
                                  className={`${
                                    !isElectronClient || printingJobId === entry.id
                                      ? 'bg-gray-400 cursor-not-allowed'
                                      : 'bg-purple-600 hover:bg-purple-700'
                                  } text-white px-4 py-1.5 rounded text-sm font-semibold min-w-[80px] inline-flex items-center justify-center gap-1`}
                                  title={!isElectronClient ? 'This feature only works from the 3D printer\'s splint computer' : ''}
                                >
                                  {printingJobId === entry.id ? (
                                    <>
                                      <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                      Sending
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                                      </svg>
                                      Print
                                    </>
                                  )}
                                </button>
                                {!isElectronClient && (
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10 max-w-[200px]">
                                    Printer only
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {entry.PrintCompletedTime && !entry.isPrintSuccessful && (
                              <button
                                onClick={() => handleMarkPrintSuccessful(entry.id)}
                                className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs min-w-[60px]"
                              >
                                ✓ Done
                              </button>
                            )}
                            
                            {/* Accept/Reject buttons - show for completed prints (progress > 99%) that haven't been accepted/rejected */}
                            {entry.progress != null && entry.progress > 99 && entry.printAcceptance === null && (
                              <>
                                <button
                                  onClick={() => setAcceptanceModal({
                                    printId: entry.id,
                                    geometryName: entry.geometryProcessingQueue.geometry.GeometryName,
                                    isAccepting: true
                                  })}
                                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-semibold min-w-[80px]"
                                  title="Accept print"
                                >
                                  ✓ Accept
                                </button>
                                <button
                                  onClick={() => setAcceptanceModal({
                                    printId: entry.id,
                                    geometryName: entry.geometryProcessingQueue.geometry.GeometryName,
                                    isAccepting: false
                                  })}
                                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded text-sm font-semibold min-w-[80px]"
                                  title="Reject print"
                                >
                                  ✗ Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <div className="text-xs text-gray-500">Object:</div>
                          <div className="text-sm font-mono font-semibold text-blue-600">
                            {entry.geometryProcessingQueue.objectID || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">Customer:</div>
                          <div className="text-sm text-gray-900">
                            {entry.geometryProcessingQueue.CustomerID || 'N/A'}
                          </div>
                          {entry.geometryProcessingQueue.CustomerNote && (
                            <div className="text-xs text-gray-500 truncate max-w-[150px] mt-1">
                              {entry.geometryProcessingQueue.CustomerNote}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <Link href={`/admin/print-queue/${entry.id}`} className="block group">
                            <div className="geometry-name text-sm font-medium text-gray-900 truncate max-w-[200px] group-hover:text-blue-600 transition-colors">
                              {entry.geometryProcessingQueue.geometry.GeometryName}
                            </div>
                          </Link>
                        </td>
                        <td className="px-2 py-2">
                          <div className="print-status flex flex-wrap gap-2">
                            {getStatusBadge(entry)}
                            {getAcceptanceBadge(entry)}
                          </div>
                          {entry.PrintStartedTime && (
                            <div className="print-started-time text-xs text-gray-500 mt-1 hidden sm:block">
                              {formatDate(entry.PrintStartedTime)}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 hidden lg:table-cell">
                          {entry.progress != null ? (
                            <div className="progress-info">
                              <div className="progress-percentage text-sm font-semibold text-gray-900">
                                {entry.progress.toFixed(1)}%
                              </div>
                              {entry.progressLastReportTime && (
                                <div className="last-updated-time text-xs text-gray-500 mt-0.5">
                                  {(() => {
                                    const lastUpdate = new Date(entry.progressLastReportTime);
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
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="action-delete inline-flex items-center justify-center w-10 h-10 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete print job"
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
          isAccepting={acceptanceModal.isAccepting}
          onClose={() => setAcceptanceModal(null)}
          onSubmit={handleAcceptanceSubmit}
        />
      )}
    </div>
  );
}