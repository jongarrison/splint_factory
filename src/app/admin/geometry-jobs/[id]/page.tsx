'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';
import ProcessingLogViewer from '@/components/ProcessingLogViewer';
import StlViewer from '@/components/StlViewer';

interface GeometryJob {
  id: string;
  objectID?: string;
  CreationTime: string;
  GeometryInputParameterData: string;
  CustomerNote?: string;
  CustomerID?: string;
  ProcessStartedTime?: string;
  ProcessCompletedTime?: string;
  isProcessSuccessful: boolean;
  isEnabled: boolean;
  ProcessingLog?: string | null;
  GeometryFileName?: string | null;
  PrintFileName?: string | null;
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
}

interface PrintJob {
  id: string;
  GeometryProcessingQueueID: string;
  PrintStartedTime?: string | null;
  PrintCompletedTime?: string | null;
  isPrintSuccessful: boolean;
  printNote?: string | null;
  printAcceptance?: boolean | null;
  isEnabled: boolean;
  CreationTime: string;
}

export default function GeometryJobDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [job, setJob] = useState<GeometryJob | null>(null);
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPrintJobs, setLoadingPrintJobs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingPrint, setCreatingPrint] = useState(false);
  const [creatingDebug, setCreatingDebug] = useState(false);
  const [id, setId] = useState<string>('');

  useEffect(() => {
    params.then(p => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user) {
      router.push('/login');
      return;
    }

    if (id) {
      fetchJob();
      fetchPrintJobs();
    }
  }, [session, status, router, id]);

  const fetchJob = async () => {
    try {
      const response = await fetch(`/api/geometry-jobs/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Geometry job not found');
        }
        throw new Error('Failed to fetch geometry job');
      }
      const data = await response.json();
      setJob(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch geometry job');
    } finally {
      setLoading(false);
    }
  };

  const fetchPrintJobs = async () => {
    try {
      setLoadingPrintJobs(true);
      const response = await fetch(`/api/print-queue?geometryJobId=${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch print jobs');
      }
      const data = await response.json();
      setPrintJobs(data);
    } catch (err) {
      console.error('Error fetching print jobs:', err);
    } finally {
      setLoadingPrintJobs(false);
    }
  };

  const handleCreatePrint = async () => {
    try {
      setCreatingPrint(true);
      
      // Create new print queue entry
      const response = await fetch('/api/print-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          GeometryProcessingQueueID: id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create print job');
      }

      const newPrintJob = await response.json();
      
      // Navigate to the new print job detail page
      router.push(`/admin/print-queue/${newPrintJob.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create print job');
      setCreatingPrint(false);
    }
  };

  const handleDebugRequest = async () => {
    if (!confirm('Create a debug request to launch Grasshopper on the processor with this job\'s script and parameters?')) {
      return;
    }

    try {
      setCreatingDebug(true);
      
      const response = await fetch('/api/geometry-processing/debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId: id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create debug request');
      }

      const result = await response.json();
      alert(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create debug request');
    } finally {
      setCreatingDebug(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (job: GeometryJob) => {
    if (!job.isEnabled) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Disabled</span>;
    }
    if (job.ProcessCompletedTime && job.isProcessSuccessful) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Completed</span>;
    }
    if (job.ProcessCompletedTime && !job.isProcessSuccessful) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Failed</span>;
    }
    if (job.ProcessStartedTime) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Processing</span>;
    }
    return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Pending</span>;
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

  const getPrintStatusBadge = (printJob: PrintJob) => {
    const printStatusBadge = (() => {
      if (printJob.PrintCompletedTime && printJob.isPrintSuccessful) {
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Print Completed</span>;
      }
      if (printJob.PrintCompletedTime && !printJob.isPrintSuccessful) {
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Print Failed</span>;
      }
      if (printJob.PrintStartedTime) {
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Printing</span>;
      }
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Ready to Print</span>;
    })();

    const acceptanceBadge = printJob.printAcceptance === true ? (
      <span 
        className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 cursor-help"
        title={printJob.printNote || 'Accepted'}
      >
        ✓ Accepted
      </span>
    ) : printJob.printAcceptance === false ? (
      <span 
        className="px-2 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 cursor-help"
        title={printJob.printNote || 'Rejected'}
      >
        ✗ Rejected
      </span>
    ) : null;

    return (
      <div className="flex flex-col gap-1">
        {printStatusBadge}
        {acceptanceBadge}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading geometry job...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-gray-900">Splint Geometry Job Details</h1>
              <Link
                href="/admin/geometry-jobs"
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium"
              >
                ← Back to Jobs
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

  if (!job) {
    return null;
  }

  const parameterData = parseParameterData(job.GeometryInputParameterData);
  const parameterSchema = parseParameterSchema(job.geometry.GeometryInputParameterSchema);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Splint Geometry Job Details</h1>
              <p className="mt-2 text-gray-600">
                View details for geometry processing job
              </p>
            </div>
            <div className="flex gap-4">
              {session?.user?.role === 'SYSTEM_ADMIN' && (
                <button
                  onClick={handleDebugRequest}
                  disabled={creatingDebug}
                  className={`${
                    creatingDebug
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-orange-600 hover:bg-orange-700'
                  } text-white px-4 py-2 rounded text-sm font-medium`}
                  title="Launch Grasshopper on processor with this job's script for debugging"
                >
                  {creatingDebug ? 'Creating...' : '🐞 Debug on Processor'}
                </button>
              )}
              <Link
                href={`/admin/geometry-jobs/new?template=${job.id}`}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-medium"
                title="Create new job with same settings"
              >
                📋 New from Template
              </Link>
              <Link
                href={`/admin/geometry-jobs/${job.id}/edit`}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium"
              >
                Edit Job
              </Link>
              <Link
                href="/admin/geometry-jobs"
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium"
              >
                ← Back to Jobs
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Associated Print Jobs */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Associated Print Jobs</h2>
              <button
                onClick={handleCreatePrint}
                disabled={creatingPrint}
                className={`${
                  creatingPrint 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-purple-600 hover:bg-purple-700'
                } text-white px-4 py-2 rounded text-sm font-medium`}
              >
                {creatingPrint ? 'Creating...' : '🖨️ New Print'}
              </button>
            </div>
            
            <div className="px-6 py-4">
              {loadingPrintJobs ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading print jobs...</p>
                </div>
              ) : printJobs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-base">No print jobs yet</p>
                  <p className="text-sm mt-2">Click "New Print" to create a print job for this geometry</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Print Job ID
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Started
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Completed
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {printJobs.map((printJob) => (
                        <tr key={printJob.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 font-mono">
                              {printJob.id.substring(0, 12)}...
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {getPrintStatusBadge(printJob)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                            {printJob.PrintStartedTime ? formatDate(printJob.PrintStartedTime) : '—'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                            {printJob.PrintCompletedTime ? formatDate(printJob.PrintCompletedTime) : '—'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                            <Link
                              href={`/admin/print-queue/${printJob.id}`}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs"
                            >
                              Details
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Status and Basic Info */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Job Information</h2>
            </div>
            <div className="px-6 py-4">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">IDs</dt>
                  <dd className="mt-1">
                    <div className="text-xs text-gray-500">Object:</div>
                    <div className="text-sm font-mono font-semibold text-blue-600">{job.objectID || 'N/A'}</div>
                    <div className="text-xs text-gray-500 mt-2">Customer:</div>
                    <div className="text-sm text-gray-900">{job.CustomerID || 'N/A'}</div>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">{getStatusBadge(job)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Job ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">{job.id}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Type</dt>
                  <dd className="mt-1">
                    <div className="text-sm font-medium text-gray-900">{job.geometry.GeometryName}</div>
                    <div className="text-xs text-gray-500">{job.geometry.GeometryAlgorithmName}</div>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(job.CreationTime)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created By</dt>
                  <dd className="mt-1 text-sm text-gray-900">{job.creator.name || job.creator.email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Organization</dt>
                  <dd className="mt-1 text-sm text-gray-900">{job.owningOrganization.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Enabled</dt>
                  <dd className="mt-1 text-sm text-gray-900">{job.isEnabled ? 'Yes' : 'No'}</dd>
                </div>
                {job.ProcessStartedTime && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Processing Started</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(job.ProcessStartedTime)}</dd>
                  </div>
                )}
                {job.ProcessCompletedTime && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Processing Completed</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(job.ProcessCompletedTime)}</dd>
                  </div>
                )}
                {job.CustomerNote && (
                  <div className="md:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Customer Note</dt>
                    <dd className="mt-1 text-sm text-gray-900">{job.CustomerNote}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Geometry Information */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Geometry Configuration</h2>
            </div>
            <div className="px-6 py-4">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {job.GeometryFileName && (
                  <div className="md:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">Geometry File</dt>
                    <dd className="mt-1 text-sm text-gray-900 flex items-center gap-3">
                      <span className="font-mono truncate" title={job.GeometryFileName}>{job.GeometryFileName}</span>
                      <a
                        href={`/api/geometry-jobs/${job.id}/geometry-file`}
                        className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium"
                      >
                        Download
                      </a>
                    </dd>
                  </div>
                )}
                {job.PrintFileName && (
                  <div className="md:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">Print File</dt>
                    <dd className="mt-1 text-sm text-gray-900 flex items-center gap-3">
                      <span className="font-mono truncate" title={job.PrintFileName}>{job.PrintFileName}</span>
                      <a
                        href={`/api/geometry-jobs/${job.id}/print-file`}
                        className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium"
                      >
                        Download
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* 3D Model Viewer */}
          {job.GeometryFileName && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">3D Model Preview</h2>
              </div>
              <div className="px-6 py-4">
                <StlViewer 
                  url={`/api/geometry-jobs/${job.id}/geometry-file`}
                  height={500}
                  modelColor="#3b82f6"
                />
              </div>
            </div>
          )}

          {/* Parameter Values */}
          {parameterSchema.length > 0 && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Parameter Values</h2>
              </div>
              <div className="px-6 py-4">
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {parameterSchema.map((param: any) => (
                    <div key={param.InputName}>
                      <dt className="text-sm font-medium text-gray-500">{param.InputDescription}</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        <span className="font-mono">
                          {parameterData[param.InputName] !== undefined 
                            ? String(parameterData[param.InputName])
                            : 'Not set'
                          }
                        </span>
                        <span className="ml-2 text-xs text-gray-500">
                          ({param.InputType})
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}

          {/* Processing Log */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4">
              <ProcessingLogViewer log={job.ProcessingLog} />
            </div>
          </div>

          {/* Raw Data (for debugging) */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Raw Parameter Data</h2>
            </div>
            <div className="px-6 py-4">
              <pre className="display-field">
                {JSON.stringify(parameterData, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}