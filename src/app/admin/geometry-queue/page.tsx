'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

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
  CreationTime: string;
  ProcessStartedTime?: string;
  ProcessCompletedTime?: string;
  isProcessSuccessful?: boolean;
  objectID: string | null;
  geometry: {
    GeometryName: string;
  };
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
}

export default function GeometryQueuePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user || session.user.role !== 'SYSTEM_ADMIN') {
      router.push('/');
      return;
    }

    fetchQueueStatus();
    const interval = setInterval(fetchQueueStatus, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [session, status, router]);

  const fetchQueueStatus = async () => {
    try {
      const response = await fetch('/api/admin/geometry-queue-status');
      if (!response.ok) throw new Error('Failed to fetch queue status');
      const data = await response.json();
      setQueueData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
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
    <div className="container mx-auto p-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">Geometry Processing Queue Status</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}

      {queueData && (
        <>
          {/* Processor Health */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">Processor Health</h2>
            <div className={`p-4 rounded-lg ${queueData.processor.isHealthy ? 'bg-green-100 border border-green-400' : 'bg-red-100 border border-red-400'}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${queueData.processor.isHealthy ? 'bg-green-600' : 'bg-red-600'}`} />
                <span className="font-semibold">
                  {queueData.processor.isHealthy ? 'Healthy' : 'Offline'}
                </span>
              </div>
              <div className="text-sm">
                Last ping: {queueData.processor.lastPingTime ? (
                  <>
                    {formatTimestamp(queueData.processor.lastPingTime)}
                    {' '}({queueData.processor.secondsSinceLastPing}s ago)
                  </>
                ) : 'Never'}
              </div>
            </div>
          </div>

          {/* Queue Summary */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">Queue Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-blue-100 border border-blue-400 p-4 rounded-lg">
                <div className="text-3xl font-bold text-blue-700">{queueData.summary.neverStartedCount}</div>
                <div className="text-sm text-blue-600">Never Started</div>
              </div>
              <div className="bg-yellow-100 border border-yellow-400 p-4 rounded-lg">
                <div className="text-3xl font-bold text-yellow-700">{queueData.summary.stuckJobsCount}</div>
                <div className="text-sm text-yellow-600">Stuck Jobs</div>
              </div>
              <div className="bg-purple-100 border border-purple-400 p-4 rounded-lg">
                <div className="text-3xl font-bold text-purple-700">{queueData.summary.processingCount}</div>
                <div className="text-sm text-purple-600">Processing Now</div>
              </div>
              <div className="bg-green-100 border border-green-400 p-4 rounded-lg">
                <div className="text-3xl font-bold text-green-700">{queueData.summary.recentlyCompletedCount}</div>
                <div className="text-sm text-green-600">Recently Completed</div>
              </div>
            </div>
            
            {/* 24-hour stats */}
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold mb-2">Last 24 Hours</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">{queueData.summary.successLast24h}</div>
                  <div className="text-xs text-gray-600">Successful</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{queueData.summary.failedLast24h}</div>
                  <div className="text-xs text-gray-600">Failed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {queueData.summary.successRate24h !== null ? `${queueData.summary.successRate24h}%` : 'N/A'}
                  </div>
                  <div className="text-xs text-gray-600">Success Rate</div>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Metrics */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">Performance Metrics</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Average Processing Time */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Avg Processing Time</h3>
                <div className="text-2xl font-bold">
                  {queueData.metrics.avgProcessingTimeSec !== null 
                    ? `${queueData.metrics.avgProcessingTimeSec}s` 
                    : 'N/A'}
                </div>
                {queueData.metrics.processingTimeTrend && (
                  <div className={`text-sm mt-1 ${
                    queueData.metrics.processingTimeTrend === 'faster' ? 'text-green-600' :
                    queueData.metrics.processingTimeTrend === 'slower' ? 'text-red-600' :
                    'text-gray-600'
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
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Avg Throughput</h3>
                <div className="text-2xl font-bold">{queueData.metrics.avgThroughputPerHour}</div>
                <div className="text-sm text-gray-600">jobs/hour</div>
              </div>
              
              {/* Queue Depth */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Queue Depth</h3>
                <div className="text-2xl font-bold">{queueData.metrics.queueDepthTrend.current}</div>
                <div className="text-sm text-gray-600">pending jobs</div>
              </div>
              
              {/* Total Processed 24h */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">24h Total</h3>
                <div className="text-2xl font-bold">
                  {queueData.summary.successLast24h + queueData.summary.failedLast24h}
                </div>
                <div className="text-sm text-gray-600">jobs processed</div>
              </div>
            </div>
            
            {/* Throughput Chart */}
            <div className="bg-white border rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Hourly Throughput (Last 24h)</h3>
              <div className="flex items-end gap-1 h-32">
                {queueData.metrics.throughputPerHour.map((bucket, idx) => {
                  const maxCount = Math.max(...queueData.metrics.throughputPerHour.map(b => b.count), 1);
                  const heightPercent = (bucket.count / maxCount) * 100;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center">
                      <div 
                        className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                        style={{ height: `${heightPercent}%` }}
                        title={`${bucket.hour}h ago: ${bucket.count} jobs`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>24h ago</span>
                <span>Now</span>
              </div>
            </div>
            
            {/* Error Breakdown & Algorithm Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Error Breakdown */}
              {queueData.metrics.errorBreakdown.length > 0 && (
                <div className="bg-white border rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-600 mb-3">Error Breakdown (24h)</h3>
                  <div className="space-y-2">
                    {queueData.metrics.errorBreakdown.map((error, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="text-sm">{error.type}</span>
                        <span className="text-sm font-semibold bg-red-100 text-red-700 px-2 py-1 rounded">
                          {error.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Algorithm Stats */}
              {queueData.metrics.algorithmStats.length > 0 && (
                <div className="bg-white border rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-600 mb-3">Jobs by Algorithm (7 days)</h3>
                  <div className="space-y-2">
                    {queueData.metrics.algorithmStats.slice(0, 10).map((algo, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="text-sm truncate flex-1" title={algo.name}>
                          {algo.algorithm}
                        </span>
                        <span className="text-sm font-semibold bg-blue-100 text-blue-700 px-2 py-1 rounded ml-2">
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
                <h3 className="text-lg font-semibold mb-2">Never Started ({queueData.queues.neverStarted.length})</h3>
                <div className="bg-white border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Object ID</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {queueData.queues.neverStarted.map((job) => (
                        <tr key={job.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm">{job.objectID || job.id.slice(0, 8)}</td>
                          <td className="px-3 py-2 text-sm text-gray-500">{getTimeDiff(job.CreationTime)}</td>
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
                <h3 className="text-lg font-semibold mb-2">Stuck Jobs ({queueData.queues.stuckJobs.length})</h3>
                <div className="bg-white border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Object ID</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {queueData.queues.stuckJobs.map((job) => (
                        <tr key={job.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm">{job.objectID || job.id.slice(0, 8)}</td>
                          <td className="px-3 py-2 text-sm text-gray-500">
                            {job.ProcessStartedTime ? getTimeDiff(job.ProcessStartedTime) : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Currently Processing */}
            {queueData.queues.processing.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Currently Processing ({queueData.queues.processing.length})</h3>
                <div className="bg-white border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Object ID</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {queueData.queues.processing.map((job) => (
                        <tr key={job.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm">{job.objectID || job.id.slice(0, 8)}</td>
                          <td className="px-3 py-2 text-sm text-gray-500">
                            {job.ProcessStartedTime ? getTimeDiff(job.ProcessStartedTime) : 'N/A'}
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
                <h3 className="text-lg font-semibold mb-2">Recently Completed ({queueData.queues.recentlyCompleted.length})</h3>
                <div className="bg-white border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Object ID</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Completed</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {queueData.queues.recentlyCompleted.map((job) => (
                        <tr key={job.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm">{job.objectID || job.id.slice(0, 8)}</td>
                          <td className="px-3 py-2 text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${job.isProcessSuccessful ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {job.isProcessSuccessful ? 'Success' : 'Failed'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500">
                            {job.ProcessCompletedTime ? getTimeDiff(job.ProcessCompletedTime) : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 text-sm text-gray-500">
            Last updated: {formatTimestamp(queueData.timestamp)}
            <button 
              onClick={fetchQueueStatus}
              className="ml-4 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Refresh Now
            </button>
          </div>
        </>
      )}
    </div>
  );
}
