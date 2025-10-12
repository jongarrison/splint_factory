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
    GeometryInputParameterData: string;
    geometry: {
      GeometryName: string;
      GeometryAlgorithmName: string;
      GeometryInputParameterSchema: string;
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

export default function PrintQueueDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [entry, setEntry] = useState<PrintQueueEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [id, setId] = useState<string>('');
  const [isElectronClient, setIsElectronClient] = useState(false);
  const [printingJobId, setPrintingJobId] = useState<string | null>(null);

  useEffect(() => {
    params.then(p => setId(p.id));
  }, [params]);

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

    if (id) {
      fetchEntry();
    }
  }, [session, status, router, id]);

  // Connect to Server-Sent Events for real-time progress updates
  useEffect(() => {
    if (!id) return;

    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/print-queue/events');

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'progress' && data.id === id) {
              // Update this entry's progress
              setEntry((prev) => 
                prev ? {
                  ...prev,
                  progress: data.progress,
                  progressLastReportTime: data.progressLastReportTime,
                } : null
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
  }, [id]);

  const fetchEntry = async () => {
    try {
      const response = await fetch(`/api/print-queue/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Print queue entry not found');
        }
        throw new Error('Failed to fetch print queue entry');
      }
      const data = await response.json();
      setEntry(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch print queue entry');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (entry: PrintQueueEntry) => {
    if (entry.PrintCompletedTime && entry.isPrintSuccessful) {
      return <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">Print Successful</span>;
    }
    if (entry.PrintCompletedTime && !entry.isPrintSuccessful) {
      return <span className="px-3 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-800">Print Failed</span>;
    }
    if (entry.PrintStartedTime) {
      const progressText = entry.progress != null ? ` ${entry.progress.toFixed(1)}%` : '';
      return <span className="px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800">Printing{progressText}</span>;
    }
    return <span className="px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">Ready to Print</span>;
  };

  const handlePrint = async () => {
    if (!entry || !isElectronClient) {
      setError('Printing is only available in the Electron client');
      return;
    }

    try {
      setPrintingJobId(entry.id);
      setError(null);

      // Get the print queue ID and geometry processing queue ID
      const printQueueId = entry.id;
      const geometryJobId = entry.geometryProcessingQueue.id;
      
      // Get session cookie for authentication
      const sessionCookie = document.cookie;
      
      // Generate a job name from the geometry and customer info
      const jobName = `${entry.geometryProcessingQueue.geometry.GeometryName.replace(/\s+/g, '_')}_${entry.geometryProcessingQueue.CustomerID || 'customer'}`;

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

      // Refresh the entry
      await fetchEntry();
      
      alert(`Print job "${result.jobName}" started successfully!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start print');
      console.error('Print error:', err);
    } finally {
      setPrintingJobId(null);
    }
  };

  const handleStartPrint = async () => {
    if (!entry) return;
    
    setUpdating(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/print-queue/${id}`, {
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

      // Refresh the entry
      await fetchEntry();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start print');
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkSuccessful = async () => {
    if (!entry) return;
    
    setUpdating(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/print-queue/${id}`, {
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
        throw new Error('Failed to mark print as successful');
      }

      // Refresh the entry
      await fetchEntry();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark print as successful');
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkFailed = async () => {
    if (!entry) return;
    
    setUpdating(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/print-queue/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isPrintSuccessful: false,
          PrintCompletedTime: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark print as failed');
      }

      // Refresh the entry
      await fetchEntry();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark print as failed');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this print job? This action cannot be undone.')) {
      return;
    }

    setUpdating(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/print-queue/${id}`, {
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

      // Redirect back to the list after successful deletion
      router.push('/admin/print-queue');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete print job');
    } finally {
      setUpdating(false);
    }
  };

  const parseParameterData = (data: string) => {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  };

  const parseParameterSchema = (schema: string) => {
    try {
      return JSON.parse(schema);
    } catch {
      return [];
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header variant={isElectronClient ? 'electron' : 'browser'} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading print queue entry...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header variant={isElectronClient ? 'electron' : 'browser'} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-gray-900">Print Queue Details</h1>
              <Link
                href="/admin/print-queue"
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium"
              >
                ← Back to Print Queue
              </Link>
            </div>
          </div>
          
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!entry) {
    return null;
  }

  const parameterData = parseParameterData(entry.geometryProcessingQueue.GeometryInputParameterData);
  const parameterSchema = parseParameterSchema(entry.geometryProcessingQueue.geometry.GeometryInputParameterSchema);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header variant={isElectronClient ? 'electron' : 'browser'} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Print Queue Details</h1>
              <p className="mt-2 text-gray-600">
                View details and manage this print job
              </p>
            </div>
            <Link
              href="/admin/print-queue"
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium"
            >
              ← Back to Print Queue
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
            <button 
              onClick={() => setError(null)}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        <div className="space-y-6">
          {/* Status and Actions */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900">Print Status</h2>
                <div className="flex items-center gap-4">
                  {getStatusBadge(entry)}
                </div>
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="flex flex-wrap gap-3">
                {!entry.PrintStartedTime && entry.hasPrintFile && (
                  <div className="relative group">
                    <button
                      onClick={() => isElectronClient ? handlePrint() : null}
                      disabled={!isElectronClient || printingJobId === entry.id}
                      className={`action-print ${
                        !isElectronClient || printingJobId === entry.id
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-purple-600 hover:bg-purple-700'
                      } text-white px-4 py-2 rounded text-sm font-medium`}
                      title={!isElectronClient ? 'This feature only works from the 3D printer\'s splint computer' : ''}
                    >
                      {printingJobId === entry.id ? 'Printing...' : '🖨️ Print'}
                    </button>
                    {!isElectronClient && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                        <div className="relative">
                          This feature only works from the 3D printer's splint computer
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {entry.PrintStartedTime && !entry.PrintCompletedTime && (
                  <>
                    <button
                      onClick={handleMarkSuccessful}
                      disabled={updating}
                      className="action-mark-successful bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm font-medium"
                    >
                      {updating ? 'Updating...' : 'Mark Successful'}
                    </button>
                    <button
                      onClick={handleMarkFailed}
                      disabled={updating}
                      className="action-mark-failed bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm font-medium"
                    >
                      {updating ? 'Updating...' : 'Mark Failed'}
                    </button>
                  </>
                )}

                {entry.PrintCompletedTime && !entry.isPrintSuccessful && (
                  <button
                    onClick={handleMarkSuccessful}
                    disabled={updating}
                    className="action-mark-successful bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm font-medium"
                  >
                    {updating ? 'Updating...' : 'Mark Successful'}
                  </button>
                )}
                
                <button
                  onClick={handleDelete}
                  disabled={updating}
                  className="action-delete bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm font-medium"
                >
                  {updating ? 'Deleting...' : 'Delete'}
                </button>
              </div>
              
              {/* Progress Bar and Info */}
              {entry.PrintStartedTime && !entry.PrintCompletedTime && (
                <div className="mt-6 border-t border-gray-200 pt-4">
                  {entry.progress != null && (
                    <div className="print-progress-section">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Print Progress</span>
                        <span className="progress-percentage text-sm font-semibold text-gray-900">{entry.progress.toFixed(1)}%</span>
                      </div>
                      <div className="progress-bar w-full bg-gray-200 rounded-full h-4">
                        <div 
                          className="progress-bar-fill bg-blue-600 h-4 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, entry.progress))}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {entry.progressLastReportTime && (
                    <div className="last-updated-time mt-3 text-sm text-gray-600">
                      Last updated: <span className="timestamp">{formatDate(entry.progressLastReportTime)}</span>
                      {(() => {
                        const lastUpdate = new Date(entry.progressLastReportTime);
                        const minutesAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 60000);
                        
                        if (minutesAgo < 1) {
                          return <span className="time-indicator time-recent ml-2 text-green-600 font-medium">(just now)</span>;
                        } else if (minutesAgo < 60) {
                          return <span className="time-indicator time-minutes ml-2 text-gray-500">(<span className="time-value">{minutesAgo}</span>m ago)</span>;
                        } else {
                          const hoursAgo = Math.floor(minutesAgo / 60);
                          return <span className="time-indicator time-hours ml-2 text-orange-600">(<span className="time-value">{hoursAgo}</span>h ago)</span>;
                        }
                      })()}
                    </div>
                  )}
                  
                  {!entry.progress && !entry.progressLastReportTime && (
                    <div className="text-sm text-gray-500 italic">
                      Waiting for progress updates from printer...
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Print Information */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Print Information</h2>
            </div>
            <div className="px-6 py-4">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Print Queue ID</dt>
                  <dd className="print-queue-id mt-1 text-sm text-gray-900 font-mono">{entry.id}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Geometry Job ID</dt>
                  <dd className="geometry-job-id mt-1 text-sm text-gray-900 font-mono">
                    <Link 
                      href={`/admin/geometry-jobs/${entry.geometryProcessingQueue.id}`}
                      className="text-blue-600 hover:text-blue-500"
                    >
                      {entry.geometryProcessingQueue.id}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Geometry Created</dt>
                  <dd className="geometry-creation-time mt-1 text-sm text-gray-900">{formatDate(entry.geometryProcessingQueue.CreationTime)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created By</dt>
                  <dd className="creator-name mt-1 text-sm text-gray-900">{entry.geometryProcessingQueue.creator.name || entry.geometryProcessingQueue.creator.email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Organization</dt>
                  <dd className="organization-name mt-1 text-sm text-gray-900">{entry.geometryProcessingQueue.owningOrganization.name}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Print Status Details */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Print Status Details</h2>
            </div>
            <div className="px-6 py-4">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Print Started</dt>
                  <dd className="print-started-time mt-1 text-sm text-gray-900">
                    {entry.PrintStartedTime ? formatDate(entry.PrintStartedTime) : (
                      <span className="text-gray-400 italic">Not started</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Print Completed</dt>
                  <dd className="print-completed-time mt-1 text-sm text-gray-900">
                    {entry.PrintCompletedTime ? formatDate(entry.PrintCompletedTime) : (
                      <span className="text-gray-400 italic">In progress</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Current Progress</dt>
                  <dd className="progress mt-1 text-sm text-gray-900">
                    {entry.progress != null ? (
                      <span className="font-semibold">{entry.progress.toFixed(1)}%</span>
                    ) : (
                      <span className="text-gray-400 italic">No data</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Progress Update</dt>
                  <dd className="progress-last-report-time mt-1 text-sm text-gray-900">
                    {entry.progressLastReportTime ? (
                      <>
                        {formatDate(entry.progressLastReportTime)}
                        {(() => {
                          const lastUpdate = new Date(entry.progressLastReportTime);
                          const minutesAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 60000);
                          
                          if (minutesAgo < 1) {
                            return <span className="ml-2 text-green-600 font-medium">(just now)</span>;
                          } else if (minutesAgo < 60) {
                            return <span className="ml-2 text-gray-500">({minutesAgo}m ago)</span>;
                          } else {
                            const hoursAgo = Math.floor(minutesAgo / 60);
                            return <span className="ml-2 text-orange-600">({hoursAgo}h ago)</span>;
                          }
                        })()}
                      </>
                    ) : (
                      <span className="text-gray-400 italic">No updates</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Print Status</dt>
                  <dd className="is-print-successful mt-1 text-sm">
                    {entry.PrintCompletedTime ? (
                      entry.isPrintSuccessful ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✓ Successful
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          ✗ Failed
                        </span>
                      )
                    ) : entry.PrintStartedTime ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        ⟳ In Progress
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        ⏸ Ready
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Print Note</dt>
                  <dd className="print-note mt-1 text-sm text-gray-900">
                    <span className="text-gray-400 italic">Not implemented</span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Files */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Files</h2>
            </div>
            <div className="px-6 py-4">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Geometry File (3MF)</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {entry.hasGeometryFile ? (
                      <span className="geometry-filename file-status-badge inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {entry.GeometryFileName || 'geometry.3mf'}
                      </span>
                    ) : (
                      <span className="text-gray-500">Not available</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Print File (GCode)</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {entry.hasPrintFile ? (
                      <span className="print-filename file-status-badge inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {entry.PrintFileName || 'print.gcode'}
                      </span>
                    ) : (
                      <span className="text-gray-500">Not available</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Customer Information */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Customer Information</h2>
            </div>
            <div className="px-6 py-4">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Customer ID</dt>
                  <dd className="customer-id mt-1 text-sm text-gray-900">{entry.geometryProcessingQueue.CustomerID || 'Not specified'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Customer Note</dt>
                  <dd className="customer-note mt-1 text-sm text-gray-900">{entry.geometryProcessingQueue.CustomerNote || 'No note provided'}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Geometry Configuration */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Geometry Configuration</h2>
            </div>
            <div className="px-6 py-4">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Geometry Name</dt>
                  <dd className="geometry-name mt-1 text-sm text-gray-900">{entry.geometryProcessingQueue.geometry.GeometryName}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Algorithm</dt>
                  <dd className="geometry-algorithm mt-1 text-sm text-gray-900 font-mono">{entry.geometryProcessingQueue.geometry.GeometryAlgorithmName}</dd>
                </div>
              </dl>

              {/* Parameter Values */}
              {parameterSchema.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Parameter Values</h3>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {parameterSchema.map((param: any) => (
                      <div key={param.InputName} className="geometry-parameter">
                        <dt className="parameter-name text-xs font-medium text-gray-500">{param.InputDescription}</dt>
                        <dd className="parameter-value mt-1 text-sm text-gray-900">
                          <span className="font-mono">
                            {parameterData[param.InputName] !== undefined 
                              ? String(parameterData[param.InputName])
                              : 'Not set'
                            }
                          </span>
                          <span className="parameter-type ml-2 text-xs text-gray-500">
                            ({param.InputType})
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}