'use client';

import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';
import ProcessingLogViewer from '@/components/ProcessingLogViewer';
import StlViewer from '@/components/StlViewer';
import PrintStatusBadge from '@/components/PrintStatusBadge';
import PrintAcceptanceBadge from '@/components/PrintAcceptanceBadge';
import PrintAcceptanceModal from '@/components/PrintAcceptanceModal';
import { formatDate } from '@/lib/formatDate';
import { formatBytes } from '@/lib/formatBytes';

interface GeometryJob {
  id: string;
  objectId?: string;
  createdAt: string;
  inputParameters: string;
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

interface PrintJobPhoto {
  id: string;
  photoUrl: string;
  progress: number;
  capturedAt: string;
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
  progress?: number | null;
  progressLastReportAt?: string | null;
}

interface InputParameterDefinition {
  InputName: string;
  InputDescription: string;
  InputType: string;
}

export default function GeometryJobDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightedPrintJobId = searchParams.get('printJobId');
  const [job, setJob] = useState<GeometryJob | null>(null);
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPrintJobs, setLoadingPrintJobs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingPrint, setCreatingPrint] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [id, setId] = useState<string>('');
  const pollingRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const photoRequestedRef = useRef<Set<string>>(new Set());
  const [isElectronClient, setIsElectronClient] = useState(false);
  const [expandedPrintJobId, setExpandedPrintJobId] = useState<string | null>(null);
  const [printJobPhotos, setPrintJobPhotos] = useState<Record<string, PrintJobPhoto[]>>({});
  const [loadingPhotos, setLoadingPhotos] = useState<Record<string, boolean>>({});
  const [acceptanceModal, setAcceptanceModal] = useState<{ printId: string; geometryName: string } | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; label: string } | null>(null);

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

  // Detect Electron client
  useEffect(() => {
    setIsElectronClient(typeof window !== 'undefined' && !!(window as any).electronAPI);
  }, []);

  // Lazy-load photos for a print job row (guarded by ref to avoid duplicate requests)
  const loadPhotosForRow = useCallback(async (printJobId: string) => {
    if (photoRequestedRef.current.has(printJobId)) return;
    photoRequestedRef.current.add(printJobId);
    setLoadingPhotos(prev => ({ ...prev, [printJobId]: true }));
    try {
      const res = await fetch(`/api/print-queue/${printJobId}`);
      if (res.ok) {
        const data = await res.json();
        setPrintJobPhotos(prev => ({ ...prev, [printJobId]: data.photos || [] }));
      } else {
        setPrintJobPhotos(prev => ({ ...prev, [printJobId]: [] }));
      }
    } catch {
      setPrintJobPhotos(prev => ({ ...prev, [printJobId]: [] }));
    } finally {
      setLoadingPhotos(prev => ({ ...prev, [printJobId]: false }));
    }
  }, []);

  // Auto-expand the highlighted print job from ?printJobId= URL param
  useEffect(() => {
    if (!highlightedPrintJobId || printJobs.length === 0) return;
    const exists = printJobs.some(pj => pj.id === highlightedPrintJobId);
    if (exists) {
      setExpandedPrintJobId(prev => prev ?? highlightedPrintJobId);
      loadPhotosForRow(highlightedPrintJobId);
    }
  }, [printJobs, highlightedPrintJobId, loadPhotosForRow]);

  // Scroll expanded row into view
  useEffect(() => {
    if (!expandedPrintJobId) return;
    const el = document.querySelector(`[data-print-job-id="${expandedPrintJobId}"]`);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    }
  }, [expandedPrintJobId]);

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

  const handleReprocess = async () => {
    if (!confirm('Reset this job so it will be reprocessed by the geo processor?')) return;
    try {
      setReprocessing(true);
      const response = await fetch(`/api/design-jobs/${id}/reprocess`, { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to reprocess job');
      }
      await fetchJob();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reprocess job');
    } finally {
      setReprocessing(false);
    }
  };

  const handleToggleExpand = (printJobId: string) => {
    if (expandedPrintJobId === printJobId) {
      setExpandedPrintJobId(null);
    } else {
      setExpandedPrintJobId(printJobId);
      loadPhotosForRow(printJobId);
    }
  };

  const handleAcceptanceSubmit = async (printId: string, acceptance: string, note: string, shouldReprint: boolean) => {
    const response = await fetch(`/api/print-queue/${printId}/acceptance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printAcceptance: acceptance, printNote: note || undefined }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update print acceptance');
    }
    if (shouldReprint) {
      const reprintRes = await fetch('/api/print-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designJobId: id }),
      });
      if (!reprintRes.ok) {
        const errData = await reprintRes.json();
        throw new Error(errData.error || 'Failed to queue reprint');
      }
    }
    await fetchPrintJobs();
  };

  const getInspectCommand = () => {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const isLocal = host.includes('localhost') || host.endsWith('.local');
    const script = isLocal ? 'inspect' : 'inspect:prod';
    return `npm run ${script} -- ${job?.objectId || id}`;
  };

  const getInspectSaveFixtureCommand = () => {
    return `${getInspectCommand()} --save-fixture`;
  };

  // navigator.clipboard is only available in secure contexts (HTTPS/localhost).
  // Fall back to a hidden textarea + execCommand for HTTP origins like splintserver.local.
  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
      return;
    }
    fallbackCopy(text);
  };

  const fallbackCopy = (text: string) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  const getStatusBadge = (job: GeometryJob) => {
    // data-testid + data-status enable stable polling from E2E tests.
    if (!job.isEnabled) {
      return <span className="status-badge status-neutral" data-testid="design-job-status" data-status="disabled">Disabled</span>;
    }
    if (job.processCompletedAt && job.isProcessSuccessful) {
      return <span className="status-badge status-success" data-testid="design-job-status" data-status="generated">Generated</span>;
    }
    if (job.processCompletedAt && !job.isProcessSuccessful) {
      return <span className="status-badge status-error" data-testid="design-job-status" data-status="failed">Failed</span>;
    }
    if (job.processStartedAt) {
      return <span className="status-badge status-warning" data-testid="design-job-status" data-status="processing">Processing</span>;
    }
    return <span className="status-badge status-pending" data-testid="design-job-status" data-status="pending">Pending</span>;
  };

  const parseParameterData = (data: string): Record<string, unknown> => {
    try {
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return {};
    }
  };

  const parseParameterSchema = (schema: string): InputParameterDefinition[] => {
    try {
      return JSON.parse(schema) as InputParameterDefinition[];
    } catch {
      return [];
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <Header />
        <div className="page-content">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-blue)] mx-auto"></div>
            <p className="mt-4 text-secondary">Loading design job...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-shell">
        <Header />
        <div className="page-content">
          <div className="mb-8 flex justify-between items-center">
            <h1 className="page-title">Design Job Details</h1>
            <Link href="/design-jobs" className="btn-neutral px-4 py-2 text-sm">
              &larr; Back to Jobs
            </Link>
          </div>
          <div className="alert-error" role="alert">{error}</div>
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
    <div className="page-shell" data-testid="design-job-detail-page">
      <Header />

      <div className="page-content">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="page-title">Design Job Details</h1>
            <div className="flex gap-4">
              {session?.user?.role === 'SYSTEM_ADMIN' && (
                <button
                  onClick={handleReprocess}
                  disabled={reprocessing || (!job.processCompletedAt && !job.processStartedAt)}
                  className="btn-warning px-4 py-2 text-sm"
                  title="Reset job state so geo processor picks it up again"
                  data-testid="reprocess-job-btn"
                >
                  {reprocessing ? 'Reprocessing...' : 'Reprocess Job'}
                </button>
              )}
              {session?.user?.role === 'SYSTEM_ADMIN' && (
                <button
                  onClick={() => setShowDebugModal(true)}
                  className="btn-warning px-4 py-2 text-sm"
                  title="Show command to launch local Grasshopper inspect session"
                  data-testid="debug-locally-btn"
                >
                  Debug Locally
                </button>
              )}
              <Link
                href={`/design-jobs/new?template=${job.id}`}
                className="btn-alt px-4 py-2 text-sm"
                title="Create new job with same settings"
                data-testid="copy-job-btn"
              >
                New Copy
              </Link>
              {isElectronClient && (
                <Link
                  href="/print-queue"
                  className="btn-neutral px-4 py-2 text-sm"
                  data-testid="back-to-print-queue-link"
                >
                  &larr; Print Queue
                </Link>
              )}
              <Link
                href="/design-jobs"
                className="btn-neutral px-4 py-2 text-sm"
                data-testid="back-to-jobs-link"
              >
                &larr; Back to Jobs
              </Link>
            </div>
          </div>
        </div>

        {/* Inline Progress Banner - shown while job is processing */}
        {isProcessing && (
          <div className="banner-info mb-6 rounded-lg px-6 py-4 flex items-center gap-4" role="status" data-testid="design-job-processing-banner">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-blue)] flex-shrink-0"></div>
            <div>
              <p className="font-semibold">
                {job.processStartedAt ? 'Processing...' : 'Queued'}
              </p>
              <p className="text-sm opacity-80">
                {job.processStartedAt
                  ? `Processing ${job.design.name}. This page will update automatically.`
                  : `${job.design.name} is waiting to be processed.`}
              </p>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {isSuccess && (
          <div className="banner-success mb-6 rounded-lg px-6 py-4 flex items-center gap-4" role="status" data-testid="design-job-success-banner">
            <div className="text-2xl flex-shrink-0">&#10003;</div>
            <div className="flex-1">
              <p className="font-semibold">Processing Complete - Ready to Print!</p>
              <p className="text-sm opacity-80">
                {job.design.name} processed successfully.
                {job.objectId && <> Object ID: <span className="font-mono font-bold">{job.objectId}</span></>}
              </p>
            </div>
          </div>
        )}

        {/* Failure Banner */}
        {isFailed && (
          <div className="banner-error mb-6 rounded-lg px-6 py-4 flex items-center gap-4" role="alert" data-testid="design-job-failure-banner">
            <div className="text-2xl flex-shrink-0">&#10007;</div>
            <div>
              <p className="font-semibold">Processing Failed</p>
              <p className="text-sm opacity-80">
                {job.design.name} encountered an error. See the processing log below.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* 3D Model Viewer - at top when available */}
          {job.meshFileName && (
            <div className="card shadow" data-testid="design-job-model-card">
              <div className="card-header">
                <h2 className="text-lg font-medium text-primary">3D Model Preview</h2>
              </div>
              <div className="card-body">
                <StlViewer
                  key={job.processCompletedAt ?? 'pending'}
                  url={`/api/design-jobs/${job.id}/mesh-file?v=${encodeURIComponent(job.processCompletedAt ?? '')}`}
                  fileName={job.meshFileName || undefined}
                  height={500}
                  modelColor="#3b82f6"
                />
              </div>
            </div>
          )}

          {/* Status and Basic Info */}
          <div className="card shadow" data-testid="design-job-info-card">
            <div className="card-header">
              <h2 className="text-lg font-medium text-primary">Design Job Info</h2>
            </div>
            <div className="card-body">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-muted">IDs</dt>
                  <dd className="mt-1">
                    <div className="text-xs text-muted">Object ID:</div>
                    <div className="text-sm font-mono font-semibold text-[var(--accent-blue)]">{job.objectId || 'N/A'}</div>
                    <div className="text-xs text-muted mt-2">Print Queue Label:</div>
                    <div className="text-sm text-primary">{job.jobLabel || 'N/A'}</div>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">Status</dt>
                  <dd className="mt-1" data-testid="job-status-cell">{getStatusBadge(job)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">Design Job ID</dt>
                  <dd className="mt-1 text-sm text-primary font-mono">{job.id}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">Type</dt>
                  <dd className="mt-1">
                    <div className="text-sm font-medium text-primary">{job.design.name}</div>
                    <div className="text-xs text-muted">{job.design.algorithmName}</div>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">Created</dt>
                  <dd className="mt-1 text-sm text-primary">{formatDate(job.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">Created By</dt>
                  <dd className="mt-1 text-sm text-primary">{job.creator.name || job.creator.email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">Organization</dt>
                  <dd className="mt-1 text-sm text-primary">{job.owningOrganization.name}</dd>
                </div>
                {/* Enabled flag is an admin-only concern; hidden for members. */}
                {session?.user?.role === 'SYSTEM_ADMIN' && (
                  <div>
                    <dt className="text-sm font-medium text-muted">Enabled</dt>
                    <dd className="mt-1 text-sm text-primary">{job.isEnabled ? 'Yes' : 'No'}</dd>
                  </div>
                )}
                {job.processStartedAt && (
                  <div>
                    <dt className="text-sm font-medium text-muted">Processing Started</dt>
                    <dd className="mt-1 text-sm text-primary">{formatDate(job.processStartedAt)}</dd>
                  </div>
                )}
                {job.processCompletedAt && (
                  <div>
                    <dt className="text-sm font-medium text-muted">Processing Completed</dt>
                    <dd className="mt-1 text-sm text-primary">{formatDate(job.processCompletedAt)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Input Values */}
          {parameterSchema.length > 0 && (
            <div className="card shadow" data-testid="design-job-input-values-card">
              <div className="card-header">
                <h2 className="text-lg font-medium text-primary">Input Values</h2>
              </div>
              <div className="card-body">
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {parameterSchema.map((param) => (
                    <div key={param.InputName}>
                      <dt className="text-sm font-medium text-muted">{param.InputDescription}</dt>
                      <dd className="mt-1 text-sm text-primary">
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
            </div>
          )}

          {/* Associated Print Jobs */}
          <div className="card shadow" data-testid="design-job-print-jobs-card">
            <div className="card-header flex justify-between items-center">
              <h2 className="text-lg font-medium text-primary">Associated Print Jobs</h2>
              {job && !job.isProcessSuccessful ? (
                <span className="text-sm text-error">Processing failed</span>
              ) : job && !job.printFileName ? (
                <span className="text-sm text-muted">No print file available</span>
              ) : (
                <button
                  onClick={handleCreatePrint}
                  disabled={creatingPrint}
                  className="btn-alt px-4 py-2 text-sm"
                  data-testid="create-print-btn"
                >
                  {creatingPrint ? 'Creating...' : 'New Print'}
                </button>
              )}
            </div>

            <div className="card-body">
              {loadingPrintJobs ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-blue)] mx-auto"></div>
                  <p className="mt-2 text-sm text-muted">Loading print jobs...</p>
                </div>
              ) : printJobs.length === 0 ? (
                <div className="text-center py-8 text-muted">
                  <p className="text-base">No print jobs yet</p>
                  <p className="text-sm mt-2">Click &quot;New Print&quot; to create a print job for this design</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table min-w-full" data-testid="print-jobs-table">
                    <thead>
                      <tr>
                        <th>Print Job ID</th>
                        <th>Status</th>
                        <th>Started</th>
                        <th>Completed</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {printJobs.map((printJob) => {
                        const isExpanded = expandedPrintJobId === printJob.id;
                        const photos = printJobPhotos[printJob.id];
                        const photosLoading = loadingPhotos[printJob.id];
                        return (
                          <Fragment key={printJob.id}>
                            <tr
                              data-testid="print-job-row"
                              data-print-job-id={printJob.id}
                              className="cursor-pointer hover:bg-[var(--surface-secondary)] transition-colors select-none"
                              onClick={() => handleToggleExpand(printJob.id)}
                            >
                              <td className="whitespace-nowrap">
                                <div className="text-sm font-medium text-primary font-mono">
                                  {printJob.id.substring(0, 12)}...
                                </div>
                              </td>
                              <td className="whitespace-nowrap" data-testid="print-job-status-cell">
                                <div className="flex flex-col gap-1">
                                  <PrintStatusBadge printStartedAt={printJob.printStartedAt} printCompletedAt={printJob.printCompletedAt} isPrintSuccessful={printJob.isPrintSuccessful} />
                                  <PrintAcceptanceBadge printAcceptance={printJob.printAcceptance} printNote={printJob.printNote} />
                                </div>
                              </td>
                              <td className="whitespace-nowrap">
                                {printJob.printStartedAt ? formatDate(printJob.printStartedAt) : '\u2014'}
                              </td>
                              <td className="whitespace-nowrap">
                                {printJob.printCompletedAt ? formatDate(printJob.printCompletedAt) : '\u2014'}
                              </td>
                              <td className="whitespace-nowrap text-center w-8">
                                <span className={`inline-block transition-transform duration-200 text-muted ${isExpanded ? 'rotate-90' : ''}`}>
                                  &#9654;
                                </span>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr data-testid="print-job-expanded-row" data-expanded-for={printJob.id}>
                                <td colSpan={5} className="px-4 pb-4 pt-2 bg-[var(--surface-secondary)]">
                                  <div className="space-y-4">
                                    {/* Summary stats */}
                                    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                                      <div>
                                        <dt className="text-xs font-medium text-muted">Progress</dt>
                                        <dd className="mt-0.5 text-primary font-semibold">
                                          {printJob.progress != null ? `${printJob.progress.toFixed(1)}%` : <span className="italic text-muted">No data</span>}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="text-xs font-medium text-muted">Print Note</dt>
                                        <dd className="mt-0.5 text-primary">
                                          {printJob.printNote || <span className="italic text-muted">None</span>}
                                        </dd>
                                      </div>
                                    </dl>

                                    {/* Review action */}
                                    {printJob.progress != null && printJob.progress > 99 && printJob.printAcceptance === null && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setAcceptanceModal({ printId: printJob.id, geometryName: job!.design.name }); }}
                                        className="btn-primary px-3 py-1.5 text-sm"
                                        data-testid="review-print-btn"
                                      >
                                        Review Print
                                      </button>
                                    )}

                                    {/* Photos */}
                                    <div>
                                      <h4 className="text-xs font-medium text-muted mb-2">Print Bed Photos</h4>
                                      {photosLoading ? (
                                        <div className="flex items-center gap-2 text-sm text-muted">
                                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--accent-blue)]"></div>
                                          Loading photos...
                                        </div>
                                      ) : photos && photos.length > 0 ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                          {photos.map((photo) => {
                                            const label = photo.progress === 0 ? 'Early' : photo.progress === 100 ? 'Final' : `${photo.progress}%`;
                                            return (
                                              <div key={photo.id} className="flex flex-col gap-1">
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); setLightboxPhoto({ url: photo.photoUrl, label }); }}
                                                  className="block w-full rounded border border-[var(--border)] overflow-hidden hover:border-[var(--accent-blue)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                                                >
                                                  <img
                                                    src={photo.photoUrl}
                                                    alt={`Print bed at ${label}`}
                                                    loading="lazy"
                                                    className="w-full object-cover aspect-video bg-[var(--surface-secondary)]"
                                                  />
                                                </button>
                                                <span className="text-xs text-muted text-center">{label}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <p className="text-sm text-muted italic">No photos captured for this print.</p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Output Files */}
          {job.meshFileName && (
            <div className="card shadow" data-testid="design-job-output-files-card">
              <div className="card-header">
                <h2 className="text-lg font-medium text-primary">Output Files</h2>
              </div>
              <div className="card-body">
                <dl>
                  <div>
                    <dt className="text-sm font-medium text-muted">Mesh File</dt>
                    <dd className="mt-1 text-sm text-primary flex items-center gap-3">
                      <span className="font-mono truncate" title={job.meshFileName}>{job.meshFileName}</span>
                      {(() => {
                        // file_size_bytes is written by splintmeshes.py save_mesh() into the
                        // job's meshMetadata JSON - the real on-disk size of the exported mesh.
                        let sizeBytes: number | undefined;
                        try {
                          const meta = job.meshMetadata ? JSON.parse(job.meshMetadata) : null;
                          sizeBytes = typeof meta?.file_size_bytes === 'number' ? meta.file_size_bytes : undefined;
                        } catch { /* meshMetadata not valid JSON; omit size */ }
                        return sizeBytes !== undefined ? (
                          <span className="text-muted">({formatBytes(sizeBytes)})</span>
                        ) : null;
                      })()}
                      <a
                        href={`/api/design-jobs/${job.id}/mesh-file`}
                        className="btn-primary text-xs px-3 py-1.5"
                      >
                        Download
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {/* Developer Info - collapsible */}
          <details className="group">
            <summary className="flex items-center cursor-pointer px-1 py-3 text-sm font-medium text-muted hover:text-[var(--text-secondary)]">
              <span className="mr-2 transition-transform group-open:rotate-90">&#9654;</span>
              Developer Info
            </summary>
            <div className="space-y-6">

          {/* Machine Files */}
          {job.printFileName && (
            <div className="card shadow">
              <div className="card-header">
                <h2 className="text-lg font-medium text-primary">Machine Files</h2>
              </div>
              <div className="card-body">
                <dl>
                  <div>
                    <dt className="text-sm font-medium text-muted">Printer Gcode File</dt>
                    <dd className="mt-1 text-sm text-primary flex items-center gap-3">
                      <span className="font-mono truncate" title={job.printFileName}>{job.printFileName}</span>
                      <a
                        href={`/api/design-jobs/${job.id}/print-file`}
                        className="btn-primary text-xs px-3 py-1.5"
                      >
                        Download
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
          {/* Mesh Output Data */}
          <div className="card shadow">
            <div className="card-header">
              <h2 className="text-lg font-medium text-primary">Mesh Output Data</h2>
            </div>
            {!job.meshMetadata ? (
              <div className="card-body">
                <p className="text-sm text-muted italic">No mesh output data available for this job.</p>
              </div>
            ) : (
              <div className="card-body">
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
          <div className="card shadow">
            <div className="card-header">
              <h2 className="text-lg font-medium text-primary">Raw Parameter Data</h2>
            </div>
            <div className="card-body">
              <pre className="display-field">
                {JSON.stringify(parameterData, null, 2)}
              </pre>
            </div>
          </div>

          {/* Processing Log */}
          <div className="card shadow">
            <div className="card-body">
              <ProcessingLogViewer log={job.processingLog} />
            </div>
          </div>

            </div>
          </details>
        </div>
      </div>

      {/* Debug Locally Modal */}
      {showDebugModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" data-testid="debug-modal">
          <div className="card shadow-xl max-w-lg w-full mx-4 p-6">
            <h3 className="text-lg font-medium text-primary mb-4">Debug Locally</h3>
            <p className="text-sm text-secondary mb-3">
              Run this command from the <code className="code-inline">splint_geo_processor</code> directory to launch Grasshopper with this job&apos;s data:
            </p>
            <div className="space-y-4">
              <div className="relative">
                <pre className="display-field">
                  {getInspectCommand()}
                </pre>
                <button
                  onClick={() => { copyToClipboard(getInspectCommand()); }}
                  className="btn-neutral absolute top-2 right-2 px-2 py-1 text-xs"
                >
                  Copy
                </button>
              </div>

              <div>
                <p className="text-sm text-secondary mb-3">
                  Use this version to also save the job definition as a reusable test fixture for future generator testing:
                </p>
                <div className="relative">
                  <pre className="display-field">
                    {getInspectSaveFixtureCommand()}
                  </pre>
                  <button
                    onClick={() => { copyToClipboard(getInspectSaveFixtureCommand()); }}
                    className="btn-neutral absolute top-2 right-2 px-2 py-1 text-xs"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowDebugModal(false)}
                className="btn-neutral px-4 py-2 text-sm"
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