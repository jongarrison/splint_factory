'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '@/components/navigation/Header';

interface ProcessorStatus {
  isHealthy: boolean;
  secondsSinceLastPing: number | null;
  lastPingTime: string | null;
}

interface QueueSummary {
  neverStartedCount: number;
  stuckJobsCount: number;
  processingCount: number;
  recentlyCompletedCount: number;
  failedLast24h: number;
  successLast24h: number;
  successRate24h: number | null;
}

interface Metrics {
  avgProcessingTimeMs: number | null;
  avgProcessingTimeSec: number | null;
  processingTimeTrend: 'faster' | 'slower' | 'stable' | null;
  processingTimeTrendPercent: number | null;
  throughputPerHour: Array<{ hour: number; count: number }>;
  avgThroughputPerHour: number;
  errorBreakdown: Array<{ type: string; count: number }>;
  algorithmStats: Array<{ algorithm: string; name: string; count: number }>;
  queueDepthTrend: {
    current: number;
    description: string;
  };
}

interface Job {
  id: string;
  createdAt: string;
  processStartedAt?: string;
  processCompletedAt?: string;
  isProcessSuccessful?: boolean;
  isDebugRequest?: boolean;
  objectId: string | null;
  design: {
    name: string;
  };
}

interface MaintenanceSettings {
  maintenanceModeEnabled: boolean;
  maintenanceMessage: string | null;
}

interface QueueData {
  timestamp: string;
  processor: ProcessorStatus;
  summary: QueueSummary;
  metrics: Metrics;
  queues: {
    neverStarted: Job[];
    stuckJobs: Job[];
    processing: Job[];
    recentlyCompleted: Job[];
  };
  maintenance: MaintenanceSettings;
}

export default function SystemStatusPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [healthCheckLoading, setHealthCheckLoading] = useState(false);
  const [healthCheckResult, setHealthCheckResult] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user || session.user.role !== 'SYSTEM_ADMIN') {
      router.push('/');
      return;
    }

    fetchQueueStatus();
  }, [session, status, router]);

  const fetchQueueStatus = async () => {
    try {
      const response = await fetch('/api/admin/system-status');
      if (!response.ok) throw new Error('Failed to fetch queue status');
      const data = await response.json();
      setQueueData(data);
      setMaintenanceEnabled(data.maintenance.maintenanceModeEnabled);
      setMaintenanceMessage(data.maintenance.maintenanceMessage || '');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleMaintenanceToggle = async () => {
    setSavingMaintenance(true);
    try {
      const response = await fetch('/api/admin/system-status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenanceModeEnabled: maintenanceEnabled,
          maintenanceMessage: maintenanceMessage || null
        })
      });
      if (!response.ok) throw new Error('Failed to update maintenance mode');
      await fetchQueueStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update maintenance mode');
    } finally {
      setSavingMaintenance(false);
    }
  };

  const handleHealthCheck = async () => {
    setHealthCheckLoading(true);
    setHealthCheckResult(null);
    try {
      // Create the health check job
      const response = await fetch('/api/admin/system-status', {
        method: 'POST'
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create health check job');
      }
      const { id: jobId, objectId } = await response.json();
      setHealthCheckResult(`Waiting for processor to complete job ${objectId}...`);

      // Poll for completion (5s interval, 5 min max)
      const maxWaitMs = 5 * 60 * 1000;
      const pollIntervalMs = 5000;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitMs) {
        await new Promise(r => setTimeout(r, pollIntervalMs));
        const statusResp = await fetch('/api/admin/system-status');
        if (!statusResp.ok) continue;
        const statusData = await statusResp.json();
        setQueueData(statusData);

        // Check all completed/processing queues for our job
        const allJobs = [
          ...statusData.queues.recentlyCompleted,
          ...statusData.queues.neverStarted,
          ...statusData.queues.processing,
          ...statusData.queues.stuckJobs
        ];
        const ourJob = allJobs.find((j: Job) => j.id === jobId);

        if (ourJob?.processCompletedAt) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          if (ourJob.isProcessSuccessful) {
            setHealthCheckResult(`Processor OK - job ${objectId} completed in ${elapsed}s`);
          } else {
            setHealthCheckResult(`Processor FAILED - job ${objectId} failed after ${elapsed}s`);
          }
          setHealthCheckLoading(false);
          return;
        }

        // Update status message based on job state
        if (ourJob?.processStartedAt) {
          setHealthCheckResult(`Processing job ${objectId}...`);
        }
      }

      setHealthCheckResult(`Timed out waiting for job ${objectId} to complete (5 min)`);
    } catch (err) {
      setHealthCheckResult(err instanceof Error ? err.message : 'Failed to create health check job');
    } finally {
      setHealthCheckLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="page-shell flex items-center justify-center" data-testid="admin-loading">
        <div className="text-lg text-secondary">Loading...</div>
      </div>
    );
  }

  if (!session?.user || session.user.role !== 'SYSTEM_ADMIN') {
    return null;
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getTimeDiff = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    if (minutes > 0) return `${minutes}m ${seconds}s ago`;
    return `${seconds}s ago`;
  };

  return (
    <div className="page-shell" data-testid="admin-page">
      <Header />
      <div className="container mx-auto p-6 max-w-7xl">
        <h1 className="page-title mb-6">System Status</h1>

      {error && (
        <div className="alert-error mb-4" data-testid="alert-error">
          Error: {error}
        </div>
      )}

      {queueData && (
        <>
          {/* Maintenance Mode Control */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3 text-primary">Maintenance Mode</h2>
            <div className="card p-4" data-testid="maintenance-card">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="maintenanceMode"
                  checked={maintenanceEnabled}
                  onChange={(e) => setMaintenanceEnabled(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="maintenanceMode" className="text-sm font-medium text-secondary">
                  Enable Maintenance Mode
                </label>
              </div>
              <div className="mb-3">
                <label htmlFor="maintenanceMessage" className="block text-sm font-medium text-secondary mb-1">
                  Maintenance Message
                </label>
                <textarea
                  id="maintenanceMessage"
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  rows={3}
                  className="input-field"
                  placeholder="Enter a message to display to users during maintenance..."
                />
              </div>
              <button
                onClick={handleMaintenanceToggle}
                disabled={savingMaintenance}
                className="btn-primary px-4 py-2"
                data-testid="save-maintenance-btn"
              >
                {savingMaintenance ? 'Saving...' : 'Save Maintenance Settings'}
              </button>
              {maintenanceEnabled && (
                <div className="alert-warning mt-3 p-3 rounded text-sm">
                  Maintenance mode is currently <strong>enabled</strong>. Users will see the maintenance banner.
                </div>
              )}
            </div>
          </div>

          {/* Processor Health */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3 text-primary">Processor Health</h2>
            <div className="card p-4 grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="processor-health-card">
              {/* Left: Polling Status */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-secondary">Polling Status</h3>
                  <button
                    onClick={fetchQueueStatus}
                    className="text-muted hover:text-secondary text-xl leading-none"
                    title="Refresh"
                  >&#x21bb;</button>
                </div>
                <div className="text-sm text-secondary">
                  Last ping: {queueData.processor.lastPingTime ? (
                    <>
                      {formatTimestamp(queueData.processor.lastPingTime)}
                      {' '}({queueData.processor.secondsSinceLastPing}s ago)
                    </>
                  ) : <span className="text-[var(--status-error-text)] font-semibold">Never</span>}
                </div>
              </div>

              {/* Right: End-to-End Check */}
              <div>
                <h3 className="text-sm font-semibold text-secondary mb-2">End-to-End Check</h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleHealthCheck}
                    disabled={healthCheckLoading}
                    className="btn-primary px-4 py-2 text-sm"
                    data-testid="health-check-btn"
                  >
                    {healthCheckLoading ? 'Checking...' : 'Check Design Processor'}
                  </button>
                </div>
                {healthCheckResult && (
                  <div className="mt-2 text-sm text-secondary">{healthCheckResult}</div>
                )}
              </div>
            </div>
          </div>

          {/* Queue Summary */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3 text-primary">Queue Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4" data-testid="queue-summary">
              <div className="p-4 rounded-lg bg-[var(--status-pending-bg)] border border-[var(--status-pending-text)]">
                <div className="text-3xl font-bold text-[var(--status-pending-text)]">{queueData.summary.neverStartedCount}</div>
                <div className="text-sm text-[var(--status-pending-text)]">Never Started</div>
              </div>
              <div className="p-4 rounded-lg bg-[var(--status-warning-bg)] border border-[var(--status-warning-text)]">
                <div className="text-3xl font-bold text-[var(--status-warning-text)]">{queueData.summary.stuckJobsCount}</div>
                <div className="text-sm text-[var(--status-warning-text)]">Stuck Jobs</div>
              </div>
              <div className="p-4 rounded-lg bg-[var(--surface-secondary)] border border-[var(--accent-purple)]">
                <div className="text-3xl font-bold text-[var(--accent-purple)]">{queueData.summary.processingCount}</div>
                <div className="text-sm text-[var(--accent-purple)]">Processing Now</div>
              </div>
              <div className="p-4 rounded-lg bg-[var(--status-success-bg)] border border-[var(--status-success-text)]">
                <div className="text-3xl font-bold text-[var(--status-success-text)]">{queueData.summary.recentlyCompletedCount}</div>
                <div className="text-sm text-[var(--status-success-text)]">Recently Completed</div>
              </div>
            </div>
            
            {/* 24-hour stats */}
            <div className="card p-4" data-testid="stats-24h-card">
              <h3 className="font-semibold mb-2 text-primary">Last 24 Hours</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-[var(--status-success-text)]">{queueData.summary.successLast24h}</div>
                  <div className="text-xs text-muted">Successful</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[var(--status-error-text)]">{queueData.summary.failedLast24h}</div>
                  <div className="text-xs text-muted">Failed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[var(--accent-blue)]">
                    {queueData.summary.successRate24h !== null ? `${queueData.summary.successRate24h}%` : 'N/A'}
                  </div>
                  <div className="text-xs text-muted">Success Rate</div>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Metrics */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3 text-primary">Performance Metrics</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Average Processing Time */}
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-secondary mb-2">Avg Processing Time</h3>
                <div className="text-2xl font-bold">
                  {queueData.metrics.avgProcessingTimeSec !== null 
                    ? `${queueData.metrics.avgProcessingTimeSec}s` 
                    : 'N/A'}
                </div>
                {queueData.metrics.processingTimeTrend && (
                  <div className={`text-sm mt-1 ${
                    queueData.metrics.processingTimeTrend === 'faster' ? 'text-[var(--status-success-text)]' :
                    queueData.metrics.processingTimeTrend === 'slower' ? 'text-[var(--status-error-text)]' :
                    'text-secondary'
                  }`}>
                    {queueData.metrics.processingTimeTrend === 'faster' && '↓ Faster'}
                    {queueData.metrics.processingTimeTrend === 'slower' && '↑ Slower'}
                    {queueData.metrics.processingTimeTrend === 'stable' && '→ Stable'}
                    {queueData.metrics.processingTimeTrendPercent !== null && 
                      ` (${Math.abs(queueData.metrics.processingTimeTrendPercent)}%)`}
                  </div>
                )}
              </div>
              
              {/* Throughput */}
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-secondary mb-2">Avg Throughput</h3>
                <div className="text-2xl font-bold text-primary">{queueData.metrics.avgThroughputPerHour}</div>
                <div className="text-sm text-muted">jobs/hour</div>
              </div>
              
              {/* Queue Depth */}
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-secondary mb-2">Queue Depth</h3>
                <div className="text-2xl font-bold text-primary">{queueData.metrics.queueDepthTrend.current}</div>
                <div className="text-sm text-muted">pending jobs</div>
              </div>
              
              {/* Total Processed 24h */}
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-secondary mb-2">24h Total</h3>
                <div className="text-2xl font-bold text-primary">
                  {queueData.summary.successLast24h + queueData.summary.failedLast24h}
                </div>
                <div className="text-sm text-muted">jobs processed</div>
              </div>
            </div>
            
            {/* Throughput Chart */}
            <div className="card p-4 mb-4">
              <h3 className="text-sm font-semibold text-secondary mb-3">Hourly Throughput (Last 24h)</h3>
              <div className="flex items-end gap-1 h-32 border-l border-b border-[var(--border)] pl-1 pb-1">
                {queueData.metrics.throughputPerHour.map((bucket, idx) => {
                  const maxCount = Math.max(...queueData.metrics.throughputPerHour.map(b => b.count), 1);
                  const heightPercent = bucket.count === 0 ? 2 : Math.max((bucket.count / maxCount) * 100, 5);
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center justify-end" style={{ height: '100%' }}>
                      <div 
                        className="w-full bg-[var(--accent-blue)] rounded-t hover:bg-[var(--accent-blue-hover)] transition-colors cursor-pointer"
                        style={{ height: `${heightPercent}%`, minHeight: bucket.count > 0 ? '4px' : '2px' }}
                        title={`${24 - bucket.hour}h ago: ${bucket.count} jobs`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-muted mt-2">
                <span>24h ago</span>
                <span>Now</span>
              </div>
            </div>
            
            {/* Error Breakdown & Algorithm Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Error Breakdown */}
              {queueData.metrics.errorBreakdown.length > 0 && (
                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-secondary mb-3">Error Breakdown (24h)</h3>
                  <div className="space-y-2">
                    {queueData.metrics.errorBreakdown.map((error, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="text-sm text-secondary">{error.type}</span>
                        <span className="status-badge status-error">
                          {error.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Algorithm Stats */}
              {queueData.metrics.algorithmStats.length > 0 && (
                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-secondary mb-3">Jobs by Algorithm (7 days)</h3>
                  <div className="space-y-2">
                    {queueData.metrics.algorithmStats.slice(0, 10).map((algo, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="text-sm text-secondary truncate flex-1" title={algo.name}>
                          {algo.algorithm}
                        </span>
                        <span className="status-badge status-pending ml-2">
                          {algo.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Job Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Never Started Jobs */}
            {queueData.queues.neverStarted.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2 text-primary">Never Started ({queueData.queues.neverStarted.length})</h3>
                <div className="card overflow-hidden">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="px-3 py-2">Object ID</th>
                        <th className="px-3 py-2">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queueData.queues.neverStarted.map((job) => (
                        <tr key={job.id}>
                          <td className="px-3 py-2 text-sm">
                            {job.objectId || job.id.slice(0, 8)}
                            {job.isDebugRequest && <span className="ml-1 status-badge status-neutral">Test</span>}
                          </td>
                          <td className="px-3 py-2 text-sm text-muted">{getTimeDiff(job.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Stuck Jobs */}
            {queueData.queues.stuckJobs.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2 text-primary">Stuck Jobs ({queueData.queues.stuckJobs.length})</h3>
                <div className="card overflow-hidden">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="px-3 py-2">Object ID</th>
                        <th className="px-3 py-2">Started</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queueData.queues.stuckJobs.map((job) => (
                        <tr key={job.id}>
                          <td className="px-3 py-2 text-sm">
                            {job.objectId || job.id.slice(0, 8)}
                            {job.isDebugRequest && <span className="ml-1 status-badge status-neutral">Test</span>}
                          </td>
                          <td className="px-3 py-2 text-sm text-muted">
                            {job.processStartedAt ? getTimeDiff(job.processStartedAt) : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Currently Processing */}
            {queueData.queues.processing.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2 text-primary">Currently Processing ({queueData.queues.processing.length})</h3>
                <div className="card overflow-hidden">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="px-3 py-2">Object ID</th>
                        <th className="px-3 py-2">Started</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queueData.queues.processing.map((job) => (
                        <tr key={job.id}>
                          <td className="px-3 py-2 text-sm">
                            {job.objectId || job.id.slice(0, 8)}
                            {job.isDebugRequest && <span className="ml-1 status-badge status-neutral">Test</span>}
                          </td>
                          <td className="px-3 py-2 text-sm text-muted">
                            {job.processStartedAt ? getTimeDiff(job.processStartedAt) : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recently Completed */}
            {queueData.queues.recentlyCompleted.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2 text-primary">Recently Completed ({queueData.queues.recentlyCompleted.length})</h3>
                <div className="card overflow-hidden">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="px-3 py-2">Object ID</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Completed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queueData.queues.recentlyCompleted.map((job) => (
                        <tr key={job.id}>
                          <td className="px-3 py-2 text-sm">
                            {job.objectId || job.id.slice(0, 8)}
                            {job.isDebugRequest && <span className="ml-1 status-badge status-neutral">Test</span>}
                          </td>
                          <td className="px-3 py-2 text-sm">
                            <span className={`status-badge ${job.isProcessSuccessful ? 'status-success' : 'status-error'}`}>
                              {job.isProcessSuccessful ? 'Success' : 'Failed'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm text-muted">
                            {job.processCompletedAt ? getTimeDiff(job.processCompletedAt) : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 text-sm text-muted">
            Last updated: {formatTimestamp(queueData.timestamp)}
            <button 
              onClick={fetchQueueStatus}
              className="btn-primary ml-4 px-3 py-1"
              data-testid="refresh-btn"
            >
              Refresh Now
            </button>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
