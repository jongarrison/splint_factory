'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';
import ProcessingLogViewer from '@/components/ProcessingLogViewer';
import StlViewer from '@/components/StlViewer';

interface GeometryJob {
  id: string;
  objectId?: string;
  createdAt: string;
  inputParameters: string;
  jobNote?: string;
  jobLabel?: string;
  processStartedAt?: string;
  processCompletedAt?: string;
  isProcessSuccessful: boolean;
  isEnabled: boolean;
  processingLog?: string | null;
  meshMetadata?: string | null;
  meshFileName?: string | null;
  printFileName?: string | null;
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
}

interface PrintJob {
  id: string;
  designJobId: string;
  printStartedAt?: string | null;
  printCompletedAt?: string | null;
  isPrintSuccessful: boolean;
  printNote?: string | null;
  printAcceptance?: string | null;
  isEnabled: boolean;
  createdAt: string;
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
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [id, setId] = useState<string>('');
  const pollingRef = useRef<NodeJS.Timeout | undefined>(undefined);

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

  // Poll while the job is still processing
  useEffect(() => {
    const isProcessing = job && !job.processCompletedAt;
    if (!isProcessing || !id) {
      clearInterval(pollingRef.current);
      return;
    }
    pollingRef.current = setInterval(() => {
      fetchJobQuiet();
    }, 3000);
    return () => clearInterval(pollingRef.current);
  }, [job?.processCompletedAt, id]);

  const fetchJob = async () => {
    try {
      const response = await fetch(`/api/design-jobs/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Design job not found');
        }
        throw new Error('Failed to fetch design job');
      }
      const data = await response.json();
      setJob(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch design job');
    } finally {
      setLoading(false);
    }
  };

  // Silent re-fetch for polling (no loading state changes)
  const fetchJobQuiet = useCallback(async () => {
    try {
      const response = await fetch(`/api/design-jobs/${id}`);
      if (response.ok) {
        const data = await response.json();
        setJob(data);
      }
    } catch {
      // Silently ignore polling errors
    }
  }, [id]);

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
          designJobId: id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create print job');
      }

      const newPrintJob = await response.json();
      
      // Navigate to the new print job detail page
      router.push(`/print-queue/${newPrintJob.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create print job');
      setCreatingPrint(false);
    }
  };

  const getInspectCommand = () => {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const isLocal = host.includes('localhost') || host.endsWith('.local');
    const script = isLocal ? 'inspect' : 'inspect:prod';
    return `npm run ${script} -- ${job?.objectId || id}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (job: GeometryJob) => {
    if (!job.isEnabled) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Disabled</span>;
    }
    if (job.processCompletedAt && job.isProcessSuccessful) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Completed</span>;
    }
    if (job.processCompletedAt && !job.isProcessSuccessful) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Failed</span>;
    }
    if (job.processStartedAt) {
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
      if (printJob.printCompletedAt && printJob.isPrintSuccessful) {
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Print Completed</span>;
      }
      if (printJob.printCompletedAt && !printJob.isPrintSuccessful) {
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Print Failed</span>;
      }
      if (printJob.printStartedAt) {
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Printing</span>;
      }
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Ready to Print</span>;
    })();

    const acceptanceBadge = printJob.printAcceptance === 'ACCEPTED' ? (
      <span 
        className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 cursor-help"
        title={printJob.printNote || 'Accepted'}
      >
        Accepted
      </span>
    ) : printJob.printAcceptance === 'REJECT_DESIGN' ? (
      <span 
        className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 cursor-help"
        title={printJob.printNote || 'Rejected - Design'}
      >
        Rejected - Design
      </span>
    ) : printJob.printAcceptance === 'REJECT_PRINT' ? (
      <span 
        className="px-2 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 cursor-help"
        title={printJob.printNote || 'Rejected - Print'}
      >
        Rejected - Print
      </span>
    ) : printJob.printAcceptance === 'REJECTED' ? (
      <span 
        className="px-2 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 cursor-help"
        title={printJob.printNote || 'Rejected'}
      >
        Rejected
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
            <p className="mt-4 text-gray-600">Loading design job...</p>
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
              <h1 className="text-3xl font-bold text-gray-900">Design Job Details</h1>
              <Link
                href="/design-jobs"
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

  const parameterData = parseParameterData(job.inputParameters);
  const parameterSchema = parseParameterSchema(job.design.inputParameterSchema);
  const isProcessing = !job.processCompletedAt;
  const isSuccess = job.processCompletedAt && job.isProcessSuccessful;
  const isFailed = job.processCompletedAt && !job.isProcessSuccessful;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Design Job Details</h1>
            </div>
            <div className="flex gap-4">
              {session?.user?.role === 'SYSTEM_ADMIN' && (
                <button
                  onClick={() => setShowDebugModal(true)}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded text-sm font-medium"
                  title="Show command to launch local Grasshopper inspect session"
                >
                  Debug Locally
                </button>
              )}
              <Link
                href={`/design-jobs/new?template=${job.id}`}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-medium"
                title="Create new job with same settings"
              >
                New from Template
              </Link>
              <Link
                href="/design-jobs"
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium"
              >
                &larr; Back to Jobs
              </Link>
            </div>
          </div>
        </div>

        {/* Inline Progress Banner - shown while job is processing */}
        {isProcessing && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-6 py-4 flex items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 flex-shrink-0"></div>
            <div>
              <p className="font-semibold text-blue-800">
                {job.processStartedAt ? 'Processing...' : 'Queued'}
              </p>
              <p className="text-sm text-blue-600">
                {job.processStartedAt
                  ? `Processing ${job.design.name}. This page will update automatically.`
                  : `${job.design.name} is waiting to be processed.`}
              </p>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {isSuccess && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-6 py-4 flex items-center gap-4">
            <div className="text-2xl flex-shrink-0">&#10003;</div>
            <div className="flex-1">
              <p className="font-semibold text-green-800">Processing Complete - Ready to Print!</p>
              <p className="text-sm text-green-600">
                {job.design.name} processed successfully.
                {job.objectId && <> Object ID: <span className="font-mono font-bold">{job.objectId}</span></>}
              </p>
            </div>
          </div>
        )}

        {/* Failure Banner */}
        {isFailed && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-6 py-4 flex items-center gap-4">
            <div className="text-2xl flex-shrink-0">&#10007;</div>
            <div>
              <p className="font-semibold text-red-800">Processing Failed</p>
              <p className="text-sm text-red-600">
                {job.design.name} encountered an error. See the processing log below.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* 3D Model Viewer - at top when available */}
          {job.meshFileName && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">3D Model Preview</h2>
              </div>
              <div className="px-6 py-4">
                <StlViewer 
                  url={`/api/design-jobs/${job.id}/mesh-file`}
                  height={500}
                  modelColor="#3b82f6"
                />
              </div>
            </div>
          )}
          {/* Status and Basic Info */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Design Job Info</h2>
            </div>
            <div className="px-6 py-4">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">IDs</dt>
                  <dd className="mt-1">
                    <div className="text-xs text-gray-500">Object ID:</div>
                    <div className="text-sm font-mono font-semibold text-blue-600">{job.objectId || 'N/A'}</div>
                    <div className="text-xs text-gray-500 mt-2">Job Label:</div>
                    <div className="text-sm text-gray-900">{job.jobLabel || 'N/A'}</div>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">{getStatusBadge(job)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Design Job ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">{job.id}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Type</dt>
                  <dd className="mt-1">
                    <div className="text-sm font-medium text-gray-900">{job.design.name}</div>
                    <div className="text-xs text-gray-500">{job.design.algorithmName}</div>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(job.createdAt)}</dd>
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
                {job.processStartedAt && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Processing Started</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(job.processStartedAt)}</dd>
                  </div>
                )}
                {job.processCompletedAt && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Processing Completed</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(job.processCompletedAt)}</dd>
                  </div>
                )}
                {job.jobNote && (
                  <div className="md:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Job Note</dt>
                    <dd className="mt-1 text-sm text-gray-900">{job.jobNote}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Input Values */}
          {parameterSchema.length > 0 && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Input Values</h2>
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

          {/* Output Files */}
          {(job.meshFileName || job.printFileName) && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Output Files</h2>
              </div>
              <div className="px-6 py-4">
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {job.meshFileName && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Mesh File</dt>
                      <dd className="mt-1 text-sm text-gray-900 flex items-center gap-3">
                        <span className="font-mono truncate" title={job.meshFileName}>{job.meshFileName}</span>
                        <a
                          href={`/api/design-jobs/${job.id}/mesh-file`}
                          className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium"
                        >
                          Download
                        </a>
                      </dd>
                    </div>
                  )}
                  {job.printFileName && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Printer Gcode File</dt>
                      <dd className="mt-1 text-sm text-gray-900 flex items-center gap-3">
                        <span className="font-mono truncate" title={job.printFileName}>{job.printFileName}</span>
                        <a
                          href={`/api/design-jobs/${job.id}/print-file`}
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
          )}

          {/* Developer Info - collapsible */}
          <details className="group">
            <summary className="flex items-center cursor-pointer px-1 py-3 text-sm font-medium text-gray-500 hover:text-gray-700">
              <span className="mr-2 transition-transform group-open:rotate-90">&#9654;</span>
              Developer Info
            </summary>
            <div className="space-y-6">

          {/* Associated Print Jobs */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Associated Print Jobs</h2>
              {job && !job.isProcessSuccessful ? (
                <span className="text-sm text-red-600">Processing failed</span>
              ) : job && !job.printFileName ? (
                <span className="text-sm text-gray-500">No print file available</span>
              ) : (
                <button
                  onClick={handleCreatePrint}
                  disabled={creatingPrint}
                  className={`${
                    creatingPrint 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-purple-600 hover:bg-purple-700'
                  } text-white px-4 py-2 rounded text-sm font-medium`}
                >
                  {creatingPrint ? 'Creating...' : 'New Print'}
                </button>
              )}
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
                  <p className="text-sm mt-2">Click &quot;New Print&quot; to create a print job for this design</p>
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
                            {printJob.printStartedAt ? formatDate(printJob.printStartedAt) : '\u2014'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                            {printJob.printCompletedAt ? formatDate(printJob.printCompletedAt) : '\u2014'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                            <Link
                              href={`/print-queue/${printJob.id}`}
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

          {/* Mesh Output Data */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Mesh Output Data</h2>
            </div>
            {!job.meshMetadata ? (
              <div className="px-6 py-4">
                <p className="text-sm text-gray-500 italic">No mesh output data available for this job.</p>
              </div>
            ) : (
              <div className="px-6 py-4">
                <pre className="display-field">
                  {(() => {
                    try { return JSON.stringify(JSON.parse(job.meshMetadata), null, 2); }
                    catch { return job.meshMetadata; }
                  })()}
                </pre>
              </div>
            )}
          </div>

          {/* Raw Parameter Data */}
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

          {/* Processing Log */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4">
              <ProcessingLogViewer log={job.processingLog} />
            </div>
          </div>

            </div>
          </details>
        </div>
      </div>

      {/* Debug Locally Modal */}
      {showDebugModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Debug Locally</h3>
            <p className="text-sm text-gray-600 mb-3">
              Run this command from the <code className="bg-gray-100 px-1 rounded">splint_geo_processor</code> directory to launch Grasshopper with this job&apos;s data:
            </p>
            <div className="relative">
              <pre className="bg-gray-900 text-green-400 p-4 rounded text-sm font-mono overflow-x-auto">
                {getInspectCommand()}
              </pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(getInspectCommand());
                }}
                className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs"
              >
                Copy
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowDebugModal(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}