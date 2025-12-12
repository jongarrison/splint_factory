'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';
import { useSmartPolling } from '@/hooks/useSmartPolling';

interface GeometryJob {
  id: string;
  objectID?: string;
  CreationTime: string;
  CustomerNote?: string;
  CustomerID?: string;
  ProcessStartedTime?: string;
  ProcessCompletedTime?: string;
  isProcessSuccessful: boolean;
  isEnabled: boolean;
  geometry: {
    GeometryName: string;
    GeometryAlgorithmName: string;
  };
  creator: {
    name: string;
  };
  printQueue: Array<{
    id: string;
    printAcceptance: boolean | null;
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
  } = useSmartPolling<GeometryJob[]>('/api/geometry-jobs', {
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
    
    const job = geometryJobs?.find(j => j.objectID === searchObjectId.trim());
    if (job) {
      router.push(`/admin/geometry-jobs/${job.id}`);
    } else {
      setSearchError(`No job found with Object ID: ${searchObjectId}`);
    }
  };

  const getStatusBadge = (job: GeometryJob) => {
    const processingBadge = (() => {
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
    })();

    // Count print acceptances
    const acceptedPrints = job.printQueue.filter(p => p.printAcceptance === true).length;
    const rejectedPrints = job.printQueue.filter(p => p.printAcceptance === false).length;

    return (
      <div className="flex flex-col gap-1">
        {processingBadge}
        {acceptedPrints > 0 && (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
            ✓ {acceptedPrints} Accepted
          </span>
        )}
        {rejectedPrints > 0 && (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800">
            ✗ {rejectedPrints} Rejected
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
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading geometry jobs...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Splint Geometry Processing Jobs</h1>
          
          {/* ObjectID Search */}
          <form onSubmit={handleSearchByObjectId} className="mt-4 flex gap-2 max-w-md">
            <div className="flex-1">
              <input
                type="text"
                value={searchObjectId}
                onChange={(e) => {
                  setSearchObjectId(e.target.value.toUpperCase());
                  setSearchError('');
                }}
                placeholder="Search by Object ID..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </button>
          </form>
          
          {searchError && (
            <div className="mt-2 text-sm text-red-600">
              {searchError}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <Link
              href="/admin/geometry-jobs/new"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-sm font-medium"
            >
              Create New Job
            </Link>
            <div className="flex items-center gap-2">
              {lastUpdate && (
                <span className="text-xs text-gray-500">
                  Updated {lastUpdate.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={refreshGeometryJobs}
                disabled={isFetching}
                className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh geometry jobs"
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
              <div className="text-center py-12">
                <div className="text-gray-500 text-lg">No geometry jobs found</div>
                <p className="text-gray-400 mt-2">Create your first geometry processing job to get started.</p>
                <Link
                  href="/admin/geometry-jobs/new"
                  className="mt-4 inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Create New Job
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        IDs
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {geometryJobs.map((job) => (
                      <tr 
                        key={job.id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/admin/geometry-jobs/${job.id}`)}
                      >
                        <td className="px-6 py-4">
                          <div className="text-xs text-gray-500">Object:</div>
                          <div className="text-sm font-mono font-semibold text-blue-600">
                            {job.objectID || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">Customer:</div>
                          <div className="text-sm text-gray-900">
                            {job.CustomerID || 'N/A'}
                          </div>
                          {job.CustomerNote && (
                            <div className="text-xs text-gray-500 truncate max-w-xs mt-1">
                              {job.CustomerNote}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {job.geometry.GeometryName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {job.geometry.GeometryAlgorithmName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(job)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>{formatDate(job.CreationTime)}</div>
                          <div className="text-xs">by {job.creator.name}</div>
                        </td>
                        <td 
                          className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            href={`/admin/geometry-jobs/${job.id}`}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            View
                          </Link>
                          <Link
                            href={`/admin/geometry-jobs/${job.id}/edit`}
                            className="text-green-600 hover:text-green-900 mr-4"
                          >
                            Edit
                          </Link>
                          <Link
                            href={`/admin/geometry-jobs/new?template=${job.id}`}
                            className="text-purple-600 hover:text-purple-900"
                            title="Create new job with same settings"
                          >
                            New
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
      </div>
    </div>
  );
}