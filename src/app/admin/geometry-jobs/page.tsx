'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';

interface GeometryJob {
  id: string;
  CreationTime: string;
  GeometryInputParameterData: string;
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
    id: string;
    name: string;
    email: string;
  };
  owningOrganization: {
    name: string;
  };
}

export default function GeometryJobsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [geometryJobs, setGeometryJobs] = useState<GeometryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGeometryJobs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/geometry-jobs');
      if (!response.ok) {
        throw new Error('Failed to fetch geometry jobs');
      }
      const data = await response.json();
      setGeometryJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user) {
      router.push('/login');
      return;
    }

    fetchGeometryJobs();
  }, [session, status, router]);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
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
          <p className="mt-2 text-gray-600">
            Manage splint geometry processing queue entries for your organization.
          </p>
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

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Processing Queue</h2>
            <Link
              href="/admin/geometry-jobs/new"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
            >
              Create New Job
            </Link>
          </div>
          
          <div className="overflow-x-auto">
            {geometryJobs.length === 0 ? (
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
                        Geometry
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer Info
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
                      <tr key={job.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {job.geometry.GeometryName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {job.geometry.GeometryAlgorithmName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {job.CustomerID ? `ID: ${job.CustomerID}` : 'No ID'}
                          </div>
                          {job.CustomerNote && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {job.CustomerNote}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(job)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>{formatDate(job.CreationTime)}</div>
                          <div className="text-xs">by {job.creator.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/admin/geometry-jobs/${job.id}`}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            View
                          </Link>
                          <Link
                            href={`/admin/geometry-jobs/${job.id}/edit`}
                            className="text-green-600 hover:text-green-900"
                          >
                            Edit
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