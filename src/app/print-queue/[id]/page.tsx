'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';
import ProcessingLogViewer from '@/components/ProcessingLogViewer';
import PrintAcceptanceModal from '@/components/PrintAcceptanceModal';
import DeletePrintModal from '@/components/DeletePrintModal';
import DeviceAuthOverlay from '@/components/DeviceAuthOverlay';

interface PrintQueueEntry {
  id: string;
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
  logs?: string | null;
  designJob: {
    id: string;
    objectId?: string;
    createdAt: string;
    jobNote?: string;
    jobLabel?: string;
    inputParameters: string;
    design: {
      name: string;
      algorithmName: string;
      inputParameterSchema: string;
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
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const [entry, setEntry] = useState<PrintQueueEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [id, setId] = useState<string>('');
  const [isElectronClient, setIsElectronClient] = useState(false);
  const [printingJobId, setPrintingJobId] = useState<string | null>(null);
  const [acceptanceModal, setAcceptanceModal] = useState<{
    printId: string;
    geometryName: string;
  } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    printId: string;
    geometryName: string;
  } | null>(null);

  // Device auth state (Electron only)
  const [deviceLocked, setDeviceLocked] = useState(false);
  const [factoryUrl, setFactoryUrl] = useState('');
  const [deviceId, setDeviceId] = useState<string | null>(null);
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

  useEffect(() => {
    params.then(p => setId(p.id));
  }, [params]);

  useEffect(() => {
    // Detect if running in Electron client
    setIsElectronClient(typeof window !== 'undefined' && !!(window as any).electronAPI);
  }, []);

  // Initialize device auth state when running in Electron
  useEffect(() => {
    if (!isElectronClient) return;
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.getEnvironmentInfo) return;

    (async () => {
      try {
        const envInfo = await electronAPI.getEnvironmentInfo();
        if (envInfo.deviceId) setDeviceId(envInfo.deviceId);
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
                  progressLastReportAt: data.progressLastReportAt,
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
    if (entry.printCompletedAt && entry.isPrintSuccessful) {
      return <span className="status-badge status-success">Print Successful</span>;
    }
    if (entry.printCompletedAt && !entry.isPrintSuccessful) {
      return <span className="status-badge status-error">Print Failed</span>;
    }
    if (entry.printStartedAt) {
      const progressText = entry.progress != null ? ` ${entry.progress.toFixed(1)}%` : '';
      return <span className="status-badge status-warning">Printing{progressText}</span>;
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
    // Legacy fallback
    if (entry.printAcceptance === 'REJECTED') {
      return <span className="status-badge status-error">Rejected</span>;
    }
    return null;
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
      const geometryJobId = entry.designJob.id;
      
      // Get session cookie for authentication
      const sessionCookie = document.cookie;
      
      // Generate a job name from the geometry and customer info
      const jobName = `${entry.designJob.design.name.replace(/\s+/g, '_')}_${entry.designJob.jobLabel || 'job'}`;

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
          printStartedAt: new Date().toISOString(),
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

  // Device auth handlers
  const handleCreateChallenge = useCallback(async () => {
    if (!deviceId) throw new Error('No device ID available');
    const res = await fetch('/api/client-auth/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    if (!res.ok) return null;
    return res.json();
  }, [deviceId]);

  const handleExchangeSession = useCallback(async (challengeId: string) => {
    if (!deviceId) return false;
    const res = await fetch('/api/client-auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, deviceId }),
    });
    if (!res.ok) return false;
    // Tell NextAuth to re-read the session cookie
    // Non-critical -- cookie is already set even if this fails
    try { await updateSession(); } catch { /* ignore */ }
    return true;
  }, [deviceId]);

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

      // Refresh the entry
      await fetchEntry();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update print acceptance');
      throw err; // Re-throw so modal knows to handle error
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
          printStartedAt: new Date().toISOString(),
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
          printCompletedAt: new Date().toISOString(),
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
          printCompletedAt: new Date().toISOString(),
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

  const handleDeleteSubmit = async (printId: string, action: 'DELETE' | 'REJECT_DESIGN') => {
    setUpdating(true);
    setError(null);
    
    try {
      // If rejecting design, record that before disabling
      if (action === 'REJECT_DESIGN') {
        const acceptanceResponse = await fetch(`/api/print-queue/${printId}/acceptance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ printAcceptance: 'REJECT_DESIGN' }),
        });
        if (!acceptanceResponse.ok) {
          throw new Error('Failed to record design rejection');
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

      // Redirect back to the list after successful deletion
      router.push('/print-queue');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete print job');
      throw err;
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
      <div className="page-shell" data-testid="print-queue-detail-loading">
        <Header variant={isElectronClient ? 'electron' : 'browser'} />
        <div className="page-content">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-blue)] mx-auto"></div>
            <p className="mt-4 text-secondary">Loading print queue entry...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-shell" data-testid="print-queue-detail-error-page">
        <Header variant={isElectronClient ? 'electron' : 'browser'} />
        <div className="page-content">
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <h1 className="page-title">Print Queue Details</h1>
              <Link
                href="/print-queue"
                className="btn-neutral px-4 py-2 text-sm"
                data-testid="back-btn"
              >
                &larr; Back to Print Queue
              </Link>
            </div>
          </div>

          <div className="alert-error" data-testid="print-queue-detail-error">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!entry) {
    return null;
  }

  const parameterData = parseParameterData(entry.designJob.inputParameters);
  const parameterSchema = parseParameterSchema(entry.designJob.design.inputParameterSchema);

  return (
    <div className="page-shell" data-testid="print-queue-detail-page">
      <Header variant={isElectronClient ? 'electron' : 'browser'} />
      
      <div className="page-content">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="page-title">Print Queue Details</h1>
              <p className="mt-2 text-secondary">
                View details and manage this print job
              </p>
            </div>
            <Link
              href="/print-queue"
              className="btn-neutral px-4 py-2 text-sm"
              data-testid="back-btn"
            >
              &larr; Back to Print Queue
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 alert-error" data-testid="alert-error">
            {error}
            <button 
              onClick={() => setError(null)}
              className="ml-2 text-error"
              data-testid="dismiss-error-btn"
            >
              &#x2715;
            </button>
          </div>
        )}

        <div className="space-y-6">
          {/* Status and Actions */}
          <div className="card shadow" data-testid="print-status-card">
            <div className="card-header">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium text-primary">Print Status</h2>
                <div className="flex items-center gap-3">
                  {getStatusBadge(entry)}
                  {getAcceptanceBadge(entry)}
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="flex flex-wrap gap-3">
                {!entry.printStartedAt && entry.hasPrintFile && (
                  <div className="relative group">
                    <button
                      onClick={() => isElectronClient ? handlePrint() : null}
                      disabled={!isElectronClient || printingJobId === entry.id}
                      className="btn-alt px-4 py-2 text-sm"
                      title={!isElectronClient ? 'This feature only works from the 3D printer\'s splint computer' : ''}
                      data-testid="print-btn"
                    >
                      {printingJobId === entry.id ? 'Printing...' : '🖨️ Print'}
                    </button>
                    {!isElectronClient && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-[var(--surface)] text-primary text-xs rounded shadow-lg border border-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                        <div className="relative">
                          This feature only works from the 3D printer&apos;s splint computer
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-[var(--surface)]"></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {entry.printStartedAt && !entry.printCompletedAt && (
                  <>
                    <button
                      onClick={handleMarkSuccessful}
                      disabled={updating}
                      className="btn-success px-4 py-2 text-sm"
                      data-testid="mark-successful-btn"
                    >
                      {updating ? 'Updating...' : 'Mark Successful'}
                    </button>
                    <button
                      onClick={handleMarkFailed}
                      disabled={updating}
                      className="btn-danger px-4 py-2 text-sm"
                      data-testid="mark-failed-btn"
                    >
                      {updating ? 'Updating...' : 'Mark Failed'}
                    </button>
                  </>
                )}

                {entry.printCompletedAt && !entry.isPrintSuccessful && (
                  <button
                    onClick={handleMarkSuccessful}
                    disabled={updating}
                    className="btn-success px-4 py-2 text-sm"
                    data-testid="mark-successful-btn"
                  >
                    {updating ? 'Updating...' : 'Mark Successful'}
                  </button>
                )}
                
                {/* Review button - show for completed prints that haven't been reviewed */}
                {entry.progress != null && entry.progress > 99 && entry.printAcceptance === null && (
                    <button
                      onClick={() => setAcceptanceModal({
                        printId: entry.id,
                        geometryName: entry.designJob.design.name,
                      })}
                      className="btn-primary px-4 py-2 text-sm"
                      title="Review print quality"
                      data-testid="review-print-btn"
                    >
                      Review Print
                    </button>
                )}
                
                <button
                  onClick={() => setDeleteModal({
                    printId: entry.id,
                    geometryName: entry.designJob.design.name,
                  })}
                  disabled={updating}
                  className="btn-danger px-4 py-2 text-sm"
                  data-testid="delete-btn"
                >
                  {updating ? 'Deleting...' : 'Delete'}
                </button>
              </div>
              
              {/* Progress Bar and Info */}
              {entry.printStartedAt && !entry.printCompletedAt && (
                <div className="mt-6 border-t border-[var(--border)] pt-4">
                  {entry.progress != null && (
                    <div data-testid="print-progress-section">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-secondary">Print Progress</span>
                        <span className="text-sm font-semibold text-primary" data-testid="progress-percentage">{entry.progress.toFixed(1)}%</span>
                      </div>
                      <div className="progress-track" data-testid="progress-bar">
                        <div 
                          className="progress-fill transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, entry.progress))}%` }}
                          data-testid="progress-fill"
                        />
                      </div>
                    </div>
                  )}
                  
                  {entry.progressLastReportAt && (
                    <div className="last-updated-time mt-3 text-sm text-muted">
                      Last updated: <span className="timestamp">{formatDate(entry.progressLastReportAt)}</span>
                      {(() => {
                        const lastUpdate = new Date(entry.progressLastReportAt);
                        const minutesAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 60000);
                        
                        if (minutesAgo < 1) {
                          return <span className="ml-2 font-medium text-[var(--status-success-text)]">(just now)</span>;
                        } else if (minutesAgo < 60) {
                          return <span className="ml-2 text-muted">({minutesAgo}m ago)</span>;
                        } else {
                          const hoursAgo = Math.floor(minutesAgo / 60);
                          return <span className="ml-2 text-[var(--status-warning-text)]">({hoursAgo}h ago)</span>;
                        }
                      })()}
                    </div>
                  )}
                  
                  {!entry.progress && !entry.progressLastReportAt && (
                    <div className="text-sm text-muted italic">
                      Waiting for progress updates from printer...
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Print Information */}
          <div className="card shadow" data-testid="print-info-card">
            <div className="card-header">
              <h2 className="text-lg font-medium text-primary">Print Information</h2>
            </div>
            <div className="card-body">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-muted">IDs</dt>
                  <dd className="mt-1">
                    <div className="text-xs text-muted">Object:</div>
                    <div className="text-sm font-mono font-semibold text-[var(--accent-blue)]">{entry.designJob.objectId || 'N/A'}</div>
                    <div className="text-xs text-muted mt-2">Job:</div>
                    <div className="text-sm text-primary">{entry.designJob.jobLabel || 'N/A'}</div>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">Type</dt>
                  <dd className="mt-1">
                    <div className="text-sm font-medium text-primary">{entry.designJob.design.name}</div>
                    <div className="text-xs text-muted">{entry.designJob.design.algorithmName}</div>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">Print Queue ID</dt>
                  <dd className="mt-1 text-sm text-primary font-mono" data-testid="print-queue-id">{entry.id}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">Design Job ID</dt>
                  <dd className="mt-1 text-sm font-mono" data-testid="design-job-id">
                    <Link 
                      href={`/design-jobs/${entry.designJob.id}`}
                      className="text-link"
                    >
                      {entry.designJob.id}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">Design Created</dt>
                  <dd className="mt-1 text-sm text-primary" data-testid="design-created-at">{formatDate(entry.designJob.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">Created By</dt>
                  <dd className="mt-1 text-sm text-primary" data-testid="creator-name">{entry.designJob.creator.name || entry.designJob.creator.email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">Organization</dt>
                  <dd className="mt-1 text-sm text-primary" data-testid="organization-name">{entry.designJob.owningOrganization.name}</dd>
                </div>
                {entry.designJob.jobNote && (
                  <div className="md:col-span-2">
                    <dt className="text-sm font-medium text-muted">Job Note</dt>
                    <dd className="mt-1 text-sm text-primary">{entry.designJob.jobNote}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Print Status Details */}
          <div className="card shadow" data-testid="print-status-details-card">
            <div className="card-header">
              <h2 className="text-lg font-medium text-primary">Print Status Details</h2>
            </div>
            <div className="card-body">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-muted">Print Started</dt>
                  <dd className="mt-1 text-sm text-primary" data-testid="print-started-at">
                    {entry.printStartedAt ? formatDate(entry.printStartedAt) : (
                      <span className="text-muted italic">Not started</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">Print Completed</dt>
                  <dd className="mt-1 text-sm text-primary" data-testid="print-completed-at">
                    {entry.printCompletedAt ? formatDate(entry.printCompletedAt) : (
                      <span className="text-muted italic">In progress</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">Current Progress</dt>
                  <dd className="mt-1 text-sm text-primary" data-testid="current-progress">
                    {entry.progress != null ? (
                      <span className="font-semibold">{entry.progress.toFixed(1)}%</span>
                    ) : (
                      <span className="text-muted italic">No data</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">Last Progress Update</dt>
                  <dd className="mt-1 text-sm text-primary" data-testid="progress-last-report-at">
                    {entry.progressLastReportAt ? (
                      <>
                        {formatDate(entry.progressLastReportAt)}
                        {(() => {
                          const lastUpdate = new Date(entry.progressLastReportAt);
                          const minutesAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 60000);
                          
                          if (minutesAgo < 1) {
                            return <span className="ml-2 font-medium text-[var(--status-success-text)]">(just now)</span>;
                          } else if (minutesAgo < 60) {
                            return <span className="ml-2 text-muted">({minutesAgo}m ago)</span>;
                          } else {
                            const hoursAgo = Math.floor(minutesAgo / 60);
                            return <span className="ml-2 text-[var(--status-warning-text)]">({hoursAgo}h ago)</span>;
                          }
                        })()}
                      </>
                    ) : (
                      <span className="text-muted italic">No updates</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">Print Status</dt>
                  <dd className="mt-1 text-sm" data-testid="print-status">
                    <div className="flex flex-wrap gap-2">
                      {entry.printCompletedAt ? (
                        entry.isPrintSuccessful ? (
                          <span className="status-badge status-success">&#x2713; Successful</span>
                        ) : (
                          <span className="status-badge status-error">&#x2717; Failed</span>
                        )
                      ) : entry.printStartedAt ? (
                        <span className="status-badge status-warning">&#x27F3; In Progress</span>
                      ) : (
                        <span className="status-badge status-pending">&#x23F8; Ready</span>
                      )}
                      {entry.printAcceptance === 'ACCEPTED' && (
                        <span className="status-badge status-success">Accepted</span>
                      )}
                      {(entry.printAcceptance === 'REJECT_DESIGN' || entry.printAcceptance === 'REJECTED') && (
                        <span className="status-badge status-warning">
                          {entry.printAcceptance === 'REJECT_DESIGN' ? 'Rejected - Design' : 'Rejected'}
                        </span>
                      )}
                      {entry.printAcceptance === 'REJECT_PRINT' && (
                        <span className="status-badge status-error">Rejected - Print</span>
                      )}
                    </div>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">Print Note</dt>
                  <dd className="mt-1 text-sm text-primary" data-testid="print-note">
                    {entry.printNote ? (
                      <span>{entry.printNote}</span>
                    ) : (
                      <span className="text-muted italic">No note</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Files */}
          <div className="card shadow" data-testid="files-card">
            <div className="card-header">
              <h2 className="text-lg font-medium text-primary">Files</h2>
            </div>
            <div className="card-body">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-muted">Design File (3MF)</dt>
                  <dd className="mt-1 text-sm">
                    {entry.hasGeometryFile ? (
                      <span className="status-badge status-pending" data-testid="mesh-filename">
                        {entry.meshFileName || 'design.3mf'}
                      </span>
                    ) : (
                      <span className="text-muted">Not available</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">Print File (GCode)</dt>
                  <dd className="mt-1 text-sm">
                    {entry.hasPrintFile ? (
                      <span className="status-badge status-success" data-testid="print-filename">
                        {entry.printFileName || 'print.gcode'}
                      </span>
                    ) : (
                      <span className="text-muted">Not available</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Job Information */}
          <div className="card shadow" data-testid="job-info-card">
            <div className="card-header">
              <h2 className="text-lg font-medium text-primary">Job Information</h2>
            </div>
            <div className="card-body">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-muted">Job ID</dt>
                  <dd className="mt-1 text-sm text-primary" data-testid="job-label">{entry.designJob.jobLabel || 'Not specified'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">Job Note</dt>
                  <dd className="mt-1 text-sm text-primary" data-testid="job-note">{entry.designJob.jobNote || 'No note provided'}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Geometry Configuration */}
          <div className="card shadow" data-testid="design-config-card">
            <div className="card-header">
              <h2 className="text-lg font-medium text-primary">Design Configuration</h2>
            </div>
            <div className="card-body">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-muted">Design Name</dt>
                  <dd className="mt-1 text-sm text-primary" data-testid="design-name">{entry.designJob.design.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">Algorithm</dt>
                  <dd className="mt-1 text-sm text-primary font-mono" data-testid="design-algorithm">{entry.designJob.design.algorithmName}</dd>
                </div>
              </dl>

              {/* Parameter Values */}
              {parameterSchema.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-muted mb-3">Parameter Values</h3>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {parameterSchema.map((param: any) => (
                      <div key={param.InputName} data-testid="design-param" data-param-name={param.InputName}>
                        <dt className="text-xs font-medium text-muted">{param.InputDescription}</dt>
                        <dd className="mt-1 text-sm text-primary" data-testid="param-value">
                          <span className="font-mono">
                            {parameterData[param.InputName] !== undefined 
                              ? String(parameterData[param.InputName])
                              : 'Not set'
                            }
                          </span>
                          <span className="ml-2 text-xs text-muted">
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

          {/* Print Logs */}
          {entry.logs && (
            <div className="card shadow" data-testid="print-logs-card">
              <div className="card-body">
                <ProcessingLogViewer log={entry.logs} title="Print Logs" />
              </div>
            </div>
          )}
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

      {/* Delete Print Modal */}
      {deleteModal && (
        <DeletePrintModal
          printId={deleteModal.printId}
          geometryName={deleteModal.geometryName}
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
          approvedChallengeId={null}
          approvedUserName={null}
          inactivityTimeout={screenLockTimeoutMs}
          onLockStateChange={handleLockStateChange}
        />
      )}
    </div>
  );
}