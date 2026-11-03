'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';
import { useSmartPolling } from '@/hooks/useSmartPolling';
import { formatDate } from '@/lib/formatDate';

interface GeometryJob {
  id: string;
  designId: string;
  objectId?: string;
  createdAt: string;
  jobLabel?: string;
  processStartedAt?: string;
  processCompletedAt?: string;
  isProcessSuccessful: boolean;
  isEnabled: boolean;
  isDebugRequest?: boolean;
  design: {
    name: string;
    algorithmName: string;
    category: 'splint' | 'tool';
  };
  creator: {
    name: string | null;
  };
  owningOrganization: {
    id: string;
    name: string;
  };
  printJobs: Array<{
    id: string;
    printAcceptance: string | null;
    printCompletedAt: string | null;
  }>;
}

interface FilterOptions {
  isSystemAdmin: boolean;
  defaultOrganizationId: string | null;
  organizations: Array<{ id: string; name: string }>;
  designs: Array<{ id: string; name: string }>;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'generated', label: 'Generated' },
  { value: 'failed', label: 'Failed' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'awaiting-review', label: 'Awaiting Review' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'reject-print', label: 'Rejected - Print' },
  { value: 'reject-design', label: 'Rejected - Design' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'archived', label: 'Archived' },
] as const;

const ALL_STATUS_VALUES = STATUS_OPTIONS.map((statusOption) => statusOption.value);

function getJobStatuses(job: GeometryJob) {
  const statuses = new Set<string>();
  if (!job.isEnabled) statuses.add('disabled');
  else if (job.processCompletedAt && job.isProcessSuccessful) statuses.add('generated');
  else if (job.processCompletedAt) statuses.add('failed');
  else if (job.processStartedAt) statuses.add('processing');
  else statuses.add('pending');

  const printStatuses = new Set(job.printJobs.map((printJob) => printJob.printAcceptance));
  if (printStatuses.has('ACCEPTED')) statuses.add('accepted');
  if (printStatuses.has('REJECT_PRINT')) statuses.add('reject-print');
  if (printStatuses.has('REJECT_DESIGN')) statuses.add('reject-design');
  if (printStatuses.has('ARCHIVED')) statuses.add('archived');
  if (printStatuses.has('REJECTED')) statuses.add('rejected');
  if (job.printJobs.some((printJob) => printJob.printAcceptance === null && printJob.printCompletedAt)) {
    statuses.add('awaiting-review');
  }
  return statuses;
}

export default function GeometryJobsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [searchObjectId, setSearchObjectId] = useState('');
  const [submittedObjectId, setSubmittedObjectId] = useState('');
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('');
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [filterOptionsError, setFilterOptionsError] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [appliedCreatorName, setAppliedCreatorName] = useState('');
  const [selectedDesignId, setSelectedDesignId] = useState('');
  const [appliedDesignId, setAppliedDesignId] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    () => new Set(ALL_STATUS_VALUES)
  );
  const [appliedStatuses, setAppliedStatuses] = useState<Set<string>>(
    () => new Set(ALL_STATUS_VALUES)
  );
  const [createdFrom, setCreatedFrom] = useState('');
  const [appliedCreatedFrom, setAppliedCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [appliedCreatedTo, setAppliedCreatedTo] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [appliedSortOrder, setAppliedSortOrder] = useState<'newest' | 'oldest'>('newest');

  const isSystemAdmin = session?.user?.role === 'SYSTEM_ADMIN';
  const organizationFilterValue = selectedOrganizationId || session?.user?.organizationId || '';
  const jobsEndpoint = isSystemAdmin && organizationFilterValue
    ? `/api/design-jobs?organizationId=${encodeURIComponent(organizationFilterValue)}`
    : '/api/design-jobs';
  
  // Use smart polling hook for real-time updates
  const { 
    data: geometryJobs, 
    isLoading: loading, 
    error,
    lastUpdate,
    refresh: refreshGeometryJobs,
    isFetching
  } = useSmartPolling<GeometryJob[]>(jobsEndpoint, {
    enabled: !!session?.user
  });

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user) {
      router.push('/login');
      return;
    }
  }, [session, status, router]);

  useEffect(() => {
    if (!session?.user) return;

    const abortController = new AbortController();
    const organizationId = isSystemAdmin
      ? organizationFilterValue
      : session.user.organizationId;
    const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';

    fetch(`/api/design-jobs/filter-options${query}`, { signal: abortController.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load filter options');
        return response.json() as Promise<FilterOptions>;
      })
      .then((options) => {
        setFilterOptions(options);
        setFilterOptionsError('');
        if (isSystemAdmin && !selectedOrganizationId && options.defaultOrganizationId) {
          setSelectedOrganizationId(options.defaultOrganizationId);
        }
        setSelectedDesignId((currentDesignId) =>
          currentDesignId && !options.designs.some((design) => design.id === currentDesignId)
            ? ''
            : currentDesignId
        );
        setAppliedDesignId((currentDesignId) =>
          currentDesignId && !options.designs.some((design) => design.id === currentDesignId)
            ? ''
            : currentDesignId
        );
      })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
        setFilterOptionsError(fetchError instanceof Error ? fetchError.message : 'Failed to load filter options');
      });

    return () => abortController.abort();
  }, [session, isSystemAdmin, selectedOrganizationId, organizationFilterValue]);

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmittedObjectId(searchObjectId.trim().toUpperCase());
    setAppliedCreatorName(creatorName.trim());
    setAppliedDesignId(selectedDesignId);
    setAppliedStatuses(new Set(selectedStatuses));
    setAppliedCreatedFrom(createdFrom);
    setAppliedCreatedTo(createdTo);
    setAppliedSortOrder(sortOrder);
  };

  const normalizedCreatorName = appliedCreatorName.toLocaleLowerCase();
  const displayedGeometryJobs = geometryJobs
    ?.filter((job) => !submittedObjectId || job.objectId?.toUpperCase().includes(submittedObjectId))
    .filter((job) => !normalizedCreatorName || job.creator.name?.toLocaleLowerCase().includes(normalizedCreatorName))
    .filter((job) => !appliedDesignId || job.designId === appliedDesignId)
    .filter((job) => {
      const jobStatuses = getJobStatuses(job);
      return [...appliedStatuses].some((selectedStatus) => jobStatuses.has(selectedStatus));
    })
    .filter((job) => !appliedCreatedFrom || new Date(job.createdAt) >= new Date(`${appliedCreatedFrom}T00:00:00`))
    .filter((job) => !appliedCreatedTo || new Date(job.createdAt) <= new Date(`${appliedCreatedTo}T23:59:59.999`))
    .sort((firstJob, secondJob) => {
      const difference = new Date(secondJob.createdAt).getTime() - new Date(firstJob.createdAt).getTime();
      return appliedSortOrder === 'newest' ? difference : -difference;
    });

  const activeFilterCount = [
    Boolean(submittedObjectId),
    Boolean(normalizedCreatorName),
    Boolean(appliedDesignId),
    appliedStatuses.size !== ALL_STATUS_VALUES.length,
    Boolean(appliedCreatedFrom),
    Boolean(appliedCreatedTo),
    appliedSortOrder !== 'newest',
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearchObjectId('');
    setSubmittedObjectId('');
    setCreatorName('');
    setAppliedCreatorName('');
    setSelectedDesignId('');
    setAppliedDesignId('');
    setSelectedStatuses(new Set(ALL_STATUS_VALUES));
    setAppliedStatuses(new Set(ALL_STATUS_VALUES));
    setCreatedFrom('');
    setAppliedCreatedFrom('');
    setCreatedTo('');
    setAppliedCreatedTo('');
    setSortOrder('newest');
    setAppliedSortOrder('newest');
  };

  const toggleStatus = (statusValue: string) => {
    setSelectedStatuses((currentStatuses) => {
      const nextStatuses = new Set(currentStatuses);
      if (nextStatuses.has(statusValue)) nextStatuses.delete(statusValue);
      else nextStatuses.add(statusValue);
      return nextStatuses;
    });
  };

  const getStatusBadge = (job: GeometryJob) => {
    const processingBadge = (() => {
      if (!job.isEnabled) {
        return <span className="status-badge status-neutral">Disabled</span>;
      }
      if (job.processCompletedAt && job.isProcessSuccessful) {
        return <span className="status-badge status-success">Generated</span>;
      }
      if (job.processCompletedAt && !job.isProcessSuccessful) {
        return <span className="status-badge status-error">Failed</span>;
      }
      if (job.processStartedAt) {
        return <span className="status-badge status-warning">Processing</span>;
      }
      return <span className="status-badge status-pending">Pending</span>;
    })();

    // Collect unique review statuses across all print jobs for this design
    const statuses = new Set(job.printJobs.map(p => p.printAcceptance));
    const hasAccepted = statuses.has('ACCEPTED');
    const hasRejectPrint = statuses.has('REJECT_PRINT');
    const hasRejectDesign = statuses.has('REJECT_DESIGN');
    const hasArchived = statuses.has('ARCHIVED');
    const hasLegacyRejected = statuses.has('REJECTED');
    // "Awaiting Review" if any completed print job has no review yet
    const hasAwaitingReview = job.printJobs.some(
      p => p.printAcceptance === null && p.printCompletedAt != null
    );

    return (
      <div className="flex flex-col gap-1">
        {processingBadge}
        {hasAccepted && <span className="status-badge status-success">Accepted</span>}
        {hasRejectPrint && <span className="status-badge status-error">Rejected - Print</span>}
        {hasRejectDesign && <span className="status-badge status-warning">Rejected - Design</span>}
        {hasArchived && <span className="status-badge status-neutral">Archived</span>}
        {hasLegacyRejected && <span className="status-badge status-error">Rejected</span>}
        {hasAwaitingReview && <span className="status-badge status-pending">Awaiting Review</span>}
      </div>
    );
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

          <form onSubmit={applyFilters} data-testid="design-jobs-filter-form">
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="flex gap-2 w-full sm:w-auto sm:min-w-96">
              <div className="flex-1">
                <label htmlFor="object-id-filter" className="block text-xs text-muted mb-1">Object ID</label>
                <input
                  id="object-id-filter"
                  type="text"
                  value={searchObjectId}
                  onChange={(e) => setSearchObjectId(e.target.value.toUpperCase())}
                  placeholder="Partial Object ID"
                  className="input-field uppercase shadow-sm"
                  data-testid="object-id-search-input"
                />
              </div>
              <button
                type="submit"
                className="btn-primary px-4 py-2 text-sm self-end"
                data-testid="apply-filters-btn"
              >
                Apply filters
              </button>
            </div>

            {isSystemAdmin && (
              <div className="w-full sm:w-64" data-testid="organization-filter-container">
                <label htmlFor="organization-filter" className="block text-xs text-muted mb-1">Organization</label>
                <select
                  id="organization-filter"
                  value={organizationFilterValue}
                  onChange={(event) => {
                    setSelectedOrganizationId(event.target.value);
                    setSelectedDesignId('');
                    setAppliedDesignId('');
                  }}
                  className="input-field"
                  data-testid="organization-filter"
                >
                  <option value="all">ALL ORGS</option>
                  {filterOptions?.organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>{organization.name}</option>
                  ))}
                </select>
              </div>
            )}

          </div>

          <details className="group mt-3">
            <summary
              className="flex w-fit items-center cursor-pointer px-1 py-2 text-sm font-medium text-muted hover:text-[var(--text-secondary)]"
              data-testid="toggle-filters-btn"
            >
              <span className="mr-2 transition-transform group-open:rotate-90">&#9654;</span>
              <span data-testid="filters-label">
                Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
              </span>
            </summary>
            <div className="mt-1 border border-[var(--border-color)] bg-[var(--surface-secondary)] p-4" data-testid="expanded-filters">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div>
                  <label htmlFor="creator-filter" className="block text-xs text-muted mb-1">Submitted by</label>
                  <input
                    id="creator-filter"
                    type="text"
                    value={creatorName}
                    onChange={(event) => setCreatorName(event.target.value)}
                    placeholder="Partial name"
                    className="input-field"
                    data-testid="creator-filter"
                  />
                </div>

                <div>
                  <label htmlFor="design-filter" className="block text-xs text-muted mb-1">Design type</label>
                  <select
                    id="design-filter"
                    value={selectedDesignId}
                    onChange={(event) => setSelectedDesignId(event.target.value)}
                    className="input-field"
                    data-testid="design-filter"
                  >
                    <option value="">All design types</option>
                    {filterOptions?.designs.map((design) => (
                      <option key={design.id} value={design.id}>{design.name}</option>
                    ))}
                  </select>
                </div>

                <details className="relative" data-testid="status-filter">
                  <summary className="input-field cursor-pointer list-none">
                    {selectedStatuses.size === ALL_STATUS_VALUES.length
                      ? 'All statuses'
                      : `Status: ${selectedStatuses.size} selected`}
                  </summary>
                  <div className="absolute z-20 mt-1 w-64 border border-[var(--border-color)] bg-[var(--surface)] p-3 shadow-lg">
                    <div className="flex justify-between mb-2 text-xs">
                      <button type="button" className="text-link" onClick={() => setSelectedStatuses(new Set(ALL_STATUS_VALUES))}>Select all</button>
                      <button type="button" className="text-link" onClick={() => setSelectedStatuses(new Set())}>Clear</button>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {STATUS_OPTIONS.map((statusOption) => (
                        <label key={statusOption.value} className="flex items-center gap-2 text-sm text-primary">
                          <input
                            type="checkbox"
                            checked={selectedStatuses.has(statusOption.value)}
                            onChange={() => toggleStatus(statusOption.value)}
                            data-status-value={statusOption.value}
                          />
                          {statusOption.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </details>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="created-from-filter" className="block text-xs text-muted mb-1">Created from</label>
                    <input id="created-from-filter" type="date" value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} className="input-field" data-testid="created-from-filter" />
                  </div>
                  <div>
                    <label htmlFor="created-to-filter" className="block text-xs text-muted mb-1">Created to</label>
                    <input id="created-to-filter" type="date" value={createdTo} onChange={(event) => setCreatedTo(event.target.value)} className="input-field" data-testid="created-to-filter" />
                  </div>
                </div>

                <div>
                  <label htmlFor="sort-order" className="block text-xs text-muted mb-1">Sort</label>
                  <select id="sort-order" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as 'newest' | 'oldest')} className="input-field" data-testid="sort-order">
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button type="button" className="text-link text-sm" onClick={clearFilters} data-testid="clear-filters-btn">Clear filters</button>
              </div>
            </div>
          </details>
          </form>
        </div>

        {(error || filterOptionsError) && (
          <div className="mb-6 alert-error" role="alert" data-testid="design-jobs-error">
            {error || filterOptionsError}
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
            {!displayedGeometryJobs || displayedGeometryJobs.length === 0 ? (
              <div className="text-center py-12" data-testid="design-jobs-empty">
                {geometryJobs && geometryJobs.length > 0 ? (
                  <div className="text-muted text-lg">
                    No design jobs match the selected filters.
                  </div>
                ) : (
                  <>
                    <div className="text-muted text-lg">No design jobs found</div>
                    <p className="text-muted mt-2">Create your first design job to get started.</p>
                    <Link
                      href="/design-jobs/new"
                      className="btn-primary inline-flex mt-4 py-2 px-4"
                      data-testid="create-first-job-btn"
                    >
                      Create New Job
                    </Link>
                  </>
                )}
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
                  {displayedGeometryJobs.map((job) => (
                    <tr
                      key={job.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/design-jobs/${job.id}`)}
                      data-testid="design-job-row"
                      data-job-id={job.id}
                      data-object-id={job.objectId || ''}
                      data-creator-name={job.creator.name || ''}
                      data-design-id={job.designId}
                      data-design-name={job.design.name}
                      data-status={Array.from(getJobStatuses(job)).join(',')}
                      data-created-at={job.createdAt}
                      data-organization-id={job.owningOrganization.id}
                      data-organization-name={job.owningOrganization.name}
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
                        <div className="text-xs">by {job.creator.name || 'Unknown'}</div>
                        {isSystemAdmin && selectedOrganizationId === 'all' && (
                          <div className="text-xs" data-testid="job-organization">{job.owningOrganization.name}</div>
                        )}
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
                        {job.processCompletedAt && job.design.category === 'splint' && (
                          <Link
                            href={`/design-jobs/new?refit=${job.id}`}
                            className="text-link-alt mr-4"
                            title="Update inputs and reprocess this design job"
                            data-testid="refit-job-link"
                          >
                            Refit
                          </Link>
                        )}
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