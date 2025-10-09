'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';
import PrinterStatusBanner from '@/components/printer/PrinterStatusBanner';

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

export default function PrintQueuePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [printQueue, setPrintQueue] = useState<PrintQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isElectronClient, setIsElectronClient] = useState(false);
  const [printingJobId, setPrintingJobId] = useState<string | null>(null);

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

        {/* Printer Status Banner (only visible in Electron) */}
        <PrinterStatusBanner />

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
          <div className="px-2 py-2 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-base font-medium text-gray-900">Active Jobs</h2>
            <button
              onClick={fetchPrintQueue}
              disabled={loading}
              className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh print queue"
            >
              <svg 
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} 
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