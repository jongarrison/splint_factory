'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';

interface PrintQueueEntry {
  id: string;
  GeometryFileName?: string;
  PrintFileName?: string;
  PrintStartedTime?: string;
  PrintCompletedTime?: string;
  isPrintSuccessful: boolean;
  hasGeometryFile: boolean;
  hasPrintFile: boolean;
  progress?: number | null;
  progressLastReportTime?: string | null;
  geometryProcessingQueue: {
    id: string;
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

interface PrinterStatus {
  isActive: boolean;
  filename?: string;
  progress?: number;
  timeRemaining?: number;
  error?: string;
  needsConfiguration?: boolean;
}

export default function PrintQueuePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [printQueue, setPrintQueue] = useState<PrintQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isElectronClient, setIsElectronClient] = useState(false);
  const [printingJobId, setPrintingJobId] = useState<string | null>(null);
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>({ isActive: false });

  const fetchPrintQueue = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/print-queue');
      if (!response.ok) {
        throw new Error('Failed to fetch print queue');
      }
      const data = await response.json();
      setPrintQueue(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Detect if running in Electron client
    setIsElectronClient(typeof window !== 'undefined' && !!(window as any).electronAPI);
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user) {
      router.push('/login');
      return;
    }

    fetchPrintQueue();
  }, [session, status, router]);

  // Poll printer status when in Electron client
  // Connect to Server-Sent Events for real-time updates
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/print-queue/events');

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'progress') {
              // Update the specific entry in the list
              setPrintQueue((prev) => 
                prev.map((entry) =>
                  entry.id === data.id
                    ? {
                        ...entry,
                        progress: data.progress,
                        progressLastReportTime: data.progressLastReportTime,
                      }
                    : entry
                )
              );
            }
          } catch (err) {
            // Ignore heartbeat messages and connection confirmations
          }
        };

        eventSource.onerror = () => {
          eventSource?.close();
          // Reconnect after 5 seconds
          setTimeout(connectSSE, 5000);
        };
      } catch (err) {
        console.error('Error connecting to SSE:', err);
      }
    };

    connectSSE();

    return () => {
      eventSource?.close();
    };
  }, []);

  // Printer status polling (Electron client only)
  useEffect(() => {
    if (!isElectronClient) return;

    const pollPrinterStatus = async () => {
      try {
        const electronAPI = (window as any).electronAPI;
        if (electronAPI?.printer?.getStatus) {
          const status = await electronAPI.printer.getStatus();
          setPrinterStatus(status);
          
          // If printer is active and has progress, send update to server
          if (status.isActive && status.filename && status.progress !== undefined) {
            // Find the print job that matches this filename
            const matchingEntry = printQueue.find(
              (entry) => 
                entry.PrintStartedTime && 
                !entry.PrintCompletedTime &&
                status.filename // We'll match by correlation later
            );

            if (matchingEntry) {
              try {
                await fetch(`/api/print-queue/${matchingEntry.id}/progress`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    progress: status.progress,
                    filename: status.filename,
                  }),
                });
              } catch (err) {
                console.error('Error sending progress update:', err);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error fetching printer status:', err);
      }
    };

    // Poll every 5 seconds
    pollPrinterStatus();
    const interval = setInterval(pollPrinterStatus, 5000);

    return () => clearInterval(interval);
  }, [isElectronClient, printQueue]);

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
      fetchPrintQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update print status');
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
      fetchPrintQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start print');
    }
  };

  const handlePrint = async (entry: PrintQueueEntry) => {
    if (!isElectronClient) {
      setError('Printing is only available in the Electron client');
      return;
    }

    try {
      setPrintingJobId(entry.id);
      setError(null);

      // Get the geometry processing queue ID to download the print file
      const geometryJobId = entry.geometryProcessingQueue.id;
      
      // Get session cookie for authentication
      const sessionCookie = document.cookie;
      
      // Generate a job name from the geometry and customer info
      const jobName = `${entry.geometryProcessingQueue.geometry.GeometryName.replace(/\s+/g, '_')}_${entry.geometryProcessingQueue.CustomerID || 'customer'}`;

      // Call the Electron API to print
      const electronAPI = (window as any).electronAPI;
      const result = await electronAPI.printing.printGeometryJob(
        geometryJobId,
        sessionCookie,
        jobName
      );

      if (!result.success) {
        throw new Error(result.error || 'Print failed');
      }

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
      await fetchPrintQueue();
      
      alert(`Print job "${result.jobName}" started successfully!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start print');
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
      fetchPrintQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete print job');
    }
  };

  if (loading) {
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

        {/* Printer Status - Only shown in Electron client */}
        {isElectronClient && (
          <>
            {/* Active Printer - Printing */}
            {printerStatus.isActive && !printerStatus.error && (
              <div className="printer-status-banner printer-status-active mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-blue-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                      </svg>
                    </div>
                    <div>
                      <div className="printer-status-label text-sm font-semibold text-blue-900">Printer Active</div>
                      {printerStatus.filename && (
                        <div className="printer-filename text-xs text-blue-700 truncate max-w-xs">{printerStatus.filename}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    {printerStatus.progress !== undefined && (
                      <div className="text-center">
                        <div className="printer-progress-value text-blue-900 font-bold">{printerStatus.progress}%</div>
                        <div className="text-xs text-blue-600">Progress</div>
                      </div>
                    )}
                    {printerStatus.timeRemaining !== undefined && (
                      <div className="text-center">
                        <div className="printer-time-remaining text-blue-900 font-bold">{Math.round(printerStatus.timeRemaining / 60)}m</div>
                        <div className="text-xs text-blue-600">Remaining</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Idle Printer - Available but not printing */}
            {!printerStatus.isActive && !printerStatus.error && !printerStatus.needsConfiguration && (
              <div className="printer-status-banner printer-status-ready mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="printer-status-label text-sm font-semibold text-green-900">Printer Ready</div>
                    <div className="text-xs text-green-700">Idle - Ready to print</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Printer Error or Not Available */}
            {(printerStatus.error || printerStatus.needsConfiguration) && (
              <div className="printer-status-banner printer-status-unavailable mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <div className="printer-status-label text-sm font-semibold text-yellow-900">
                        {printerStatus.needsConfiguration ? 'Printer Not Configured' : 'Printer Unavailable'}
                      </div>
                      <div className="printer-error-message text-xs text-yellow-700">
                        {printerStatus.error || 'Please configure printer to enable printing'}
                      </div>
                    </div>
                  </div>
                  {printerStatus.needsConfiguration && (
                    <button
                      onClick={() => (window as any).electronAPI?.navigateTo('printer-manager')}
                      className="action-configure px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded"
                    >
                      Configure
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="mb-2 bg-red-50 border border-red-200 text-red-700 px-2 py-2 rounded text-sm">
            {error}
            <button 
              onClick={() => setError(null)}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        <div className="bg-white shadow rounded">
          <div className="px-2 py-2 border-b border-gray-200">
            <h2 className="text-base font-medium text-gray-900">Active Jobs</h2>
          </div>
          
          <div className="overflow-x-auto">
            {printQueue.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500 text-base">No print jobs in queue</div>
                <p className="text-gray-400 mt-1 text-sm">Jobs appear after processing.</p>
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
                        Job
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">
                        Customer
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase w-12">
                        {/* Delete column */}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {printQueue.map((entry) => (
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
                                  } text-white px-2 py-1 rounded text-xs font-semibold min-w-[60px]`}
                                  title={!isElectronClient ? 'This feature only works from the 3D printer\'s splint computer' : ''}
                                >
                                  {printingJobId === entry.id ? '...' : '🖨️ Print'}
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
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <Link href={`/admin/print-queue/${entry.id}`} className="block group">
                            <div className="geometry-name text-sm font-medium text-gray-900 truncate max-w-[200px] group-hover:text-blue-600 transition-colors">
                              {entry.geometryProcessingQueue.geometry.GeometryName}
                            </div>
                            <div className="geometry-algorithm text-xs text-gray-500 truncate max-w-[200px] group-hover:text-blue-500 transition-colors">
                              {entry.geometryProcessingQueue.geometry.GeometryAlgorithmName}
                            </div>
                            <div className="flex gap-1 mt-1">
                              {entry.hasPrintFile && (
                                <span className="file-status-badge inline-flex items-center px-1 py-0.5 rounded text-xs bg-green-100 text-green-800">
                                  GCode
                                </span>
                              )}
                            </div>
                          </Link>
                        </td>
                        <td className="px-2 py-2 hidden sm:table-cell">
                          <Link href={`/admin/print-queue/${entry.id}`} className="block group">
                            <div className="customer-id text-xs text-gray-900 truncate max-w-[150px] group-hover:text-blue-600 transition-colors">
                              {entry.geometryProcessingQueue.CustomerID ? 
                                `ID: ${entry.geometryProcessingQueue.CustomerID}` : 'No ID'}
                            </div>
                            {entry.geometryProcessingQueue.CustomerNote && (
                              <div className="customer-note text-xs text-gray-500 truncate max-w-[150px] group-hover:text-blue-500 transition-colors">
                                {entry.geometryProcessingQueue.CustomerNote}
                              </div>
                            )}
                          </Link>
                        </td>
                        <td className="px-2 py-2">
                          <div className="print-status">
                            {getStatusBadge(entry)}
                          </div>
                          {getProgressInfo(entry) && (
                            <div className="progress-timestamp mt-1">
                              {getProgressInfo(entry)}
                            </div>
                          )}
                          {entry.PrintStartedTime && (
                            <div className="print-started-time text-xs text-gray-500 mt-1 hidden sm:block">
                              {formatDate(entry.PrintStartedTime)}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="action-delete inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete print job"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    </div>
  );
}