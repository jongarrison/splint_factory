'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';
import { useSmartPolling } from '@/hooks/useSmartPolling';

interface GeometryJob {
  id: string;
  objectId?: string;
  createdAt: string;
  jobNote?: string;
  jobLabel?: string;
  processStartedAt?: string;
  processCompletedAt?: string;
  isProcessSuccessful: boolean;
  isEnabled: boolean;
  isDebugRequest?: boolean;
  design: {
    name: string;
    algorithmName: string;
  };
  creator: {
    name: string;
  };
  printJobs: Array<{
    id: string;
    printAcceptance: string | null;
  }>;
}

export default function GeometryJobsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [searchObjectId, setSearchObjectId] = useState('');
  const [searchError, setSearchError] = useState('');
  
  // Use smart polling hook for real-time updates
  const { 
    data: geometryJobs, 
    isLoading: loading, 
    error,
    lastUpdate,
    refresh: refreshGeometryJobs,
    isFetching
  } = useSmartPolling<GeometryJob[]>('/api/design-jobs', {
    enabled: !!session?.user
  });

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user) {
      router.push('/login');
      return;
    }
  }, [session, status, router]);

  const handleSearchByObjectId = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    
    if (!searchObjectId.trim()) {
      setSearchError('Please enter an Object ID');
      return;
    }
    
    const job = geometryJobs?.find(j => j.objectId === searchObjectId.trim());
    if (job) {
      router.push(`/design-jobs/${job.id}`);
    } else {
      setSearchError(`No job found with Object ID: ${searchObjectId}`);
    }
  };

  const getStatusBadge = (job: GeometryJob) => {
    const processingBadge = (() => {
      if (!job.isEnabled) {
        return <span className="status-badge status-neutral">Disabled</span>;
      }
      if (job.processCompletedAt && job.isProcessSuccessful) {
        return <span className="status-badge status-success">Completed</span>;
      }
      if (job.processCompletedAt && !job.isProcessSuccessful) {
        return <span className="status-badge status-error">Failed</span>;
      }
      if (job.processStartedAt) {
        return <span className="status-badge status-warning">Processing</span>;
      }
      return <span className="status-badge status-pending">Pending</span>;
    })();

    // Count print acceptances
    const acceptedPrints = job.printJobs.filter(p => p.printAcceptance === 'ACCEPTED').length;
    const rejectedPrints = job.printJobs.filter(p => p.printAcceptance && p.printAcceptance !== 'ACCEPTED').length;

    return (
      <div className="flex flex-col gap-1">
        {processingBadge}
        {acceptedPrints > 0 && (
          <span className="status-badge status-success">
            {acceptedPrints} Accepted
          </span>
        )}
        {rejectedPrints > 0 && (
          <span className="status-badge status-error">
            {rejectedPrints} Rejected
          </span>
        )}
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (status === 'loading' || (loading && !geometryJobs)) {
    return (
      <div className="page-shell">
        <Header />
        <div className="page-content">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-blue)] mx-auto"></div>
            <p className="mt-4 text-secondary">Loading design jobs...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell" data-testid="design-jobs-page">
      <Header />

      <div className="page-content">
        <div className="mb-8">
          <h1 className="page-title">Design Generation Jobs</h1>

          {/* ObjectID Search */}
          <form onSubmit={handleSearchByObjectId} className="mt-4 flex gap-2 max-w-md" data-testid="object-id-search-form">
            <div className="flex-1">
              <input
                type="text"
                value={searchObjectId}
                onChange={(e) => {
                  setSearchObjectId(e.target.value.toUpperCase());
                  setSearchError('');
                }}
                placeholder="Search by Object ID..."
                className="input-field uppercase shadow-sm"
                data-testid="object-id-search-input"
              />
            </div>
            <button
              type="submit"
              className="btn-primary px-4 py-2 text-sm"
              data-testid="object-id-search-btn"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </button>
          </form>

          {searchError && (
            <div className="mt-2 text-sm text-error" data-testid="object-id-search-error">
              {searchError}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 alert-error" role="alert" data-testid="design-jobs-error">
            {error}
          </div>
        )}

        <div className="card" data-testid="design-jobs-card">
          <div className="card-header flex justify-between items-center">
            <Link
              href="/design-jobs/new"
              className="btn-primary px-6 py-2 text-sm"
              data-testid="create-job-btn"
            >
              Create New Job
            </Link>
            <div className="flex items-center gap-2">
              {lastUpdate && (
                <span className="text-xs text-muted">
                  Updated {lastUpdate.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={refreshGeometryJobs}
                disabled={isFetching}
                className="btn-secondary px-3 py-1 text-sm"
                title="Refresh design jobs"
                data-testid="refresh-jobs-btn"
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

          <div className="overflow-x-auto">
            {!geometryJobs || geometryJobs.length === 0 ? (
              <div className="text-center py-12" data-testid="design-jobs-empty">
                <div className="text-muted text-lg">No design jobs found</div>
                <p className="text-muted mt-2">Create your first design job to get started.</p>
                <Link
                  href="/design-jobs/new"
                  className="btn-primary inline-flex mt-4 py-2 px-4"
                  data-testid="create-first-job-btn"
                >
                  Create New Job
                </Link>
              </div>
            ) : (
              <table className="data-table min-w-full" data-testid="design-jobs-table">
                <thead>
                  <tr>
                    <th>IDs</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {geometryJobs.map((job) => (
                    <tr
                      key={job.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/design-jobs/${job.id}`)}
                      data-testid="design-job-row"
                      data-job-id={job.id}
                    >
                      <td>
                        <div className="text-xs text-muted">Object:</div>
                        <div className="text-sm font-mono font-semibold text-[var(--accent-blue)]">
                          {job.objectId || 'N/A'}
                          {job.isDebugRequest && (
                            <span className="ml-1 status-badge status-neutral font-sans font-normal">Test</span>
                          )}
                        </div>
                        <div className="text-xs text-muted mt-1">Job:</div>
                        <div className="text-sm text-primary">
                          {job.jobLabel || 'N/A'}
                        </div>
                        {job.jobNote && (
                          <div className="text-xs text-muted truncate max-w-xs mt-1">
                            {job.jobNote}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="text-sm font-medium text-primary">
                          {job.design.name}
                        </div>
                        <div className="text-sm text-muted">
                          {job.design.algorithmName}
                        </div>
                      </td>
                      <td className="whitespace-nowrap" data-testid="job-status-cell">
                        {getStatusBadge(job)}
                      </td>
                      <td className="whitespace-nowrap text-muted">
                        <div>{formatDate(job.createdAt)}</div>
                        <div className="text-xs">by {job.creator.name}</div>
                      </td>
                      <td
                        className="whitespace-nowrap text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Link
                          href={`/design-jobs/${job.id}`}
                          className="text-link mr-4"
                          data-testid="view-job-link"
                        >
                          View
                        </Link>
                        <Link
                          href={`/design-jobs/new?template=${job.id}`}
                          className="text-link-alt"
                          title="Create new job with same settings"
                          data-testid="copy-job-link"
                        >
                          Copy
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}