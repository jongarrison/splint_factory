'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';

interface PrintQueueEntry {
  id: string;
  GeometryFileName?: string;
  PrintFileName?: string;
  PrintStartedTime?: string;
  PrintCompletedTime?: string;
  isPrintSuccessful: boolean;
  hasGeometryFile: boolean;
  hasPrintFile: boolean;
  geometryProcessingQueue: {
    id: string;
    CreationTime: string;
    CustomerNote?: string;
    CustomerID?: string;
    GeometryInputParameterData: string;
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
  };
}

export default function PrintQueueDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [entry, setEntry] = useState<PrintQueueEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      fetchEntry();
    }
  }, [session, status, router, id]);

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
    if (entry.PrintCompletedTime && entry.isPrintSuccessful) {
      return <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">Print Successful</span>;
    }
    if (entry.PrintCompletedTime && !entry.isPrintSuccessful) {
      return <span className="px-3 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-800">Print Failed</span>;
    }
    if (entry.PrintStartedTime) {
      return <span className="px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800">Printing</span>;
    }
    return <span className="px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">Ready to Print</span>;
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
          PrintStartedTime: new Date().toISOString(),
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
          PrintCompletedTime: new Date().toISOString(),
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
          PrintCompletedTime: new Date().toISOString(),
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
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading print queue entry...</p>
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
              <h1 className="text-3xl font-bold text-gray-900">Print Queue Details</h1>
              <Link
                href="/admin/print-queue"
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium"
              >
                ← Back to Print Queue
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

  if (!entry) {
    return null;
  }

  const parameterData = parseParameterData(entry.geometryProcessingQueue.GeometryInputParameterData);
  const parameterSchema = parseParameterSchema(entry.geometryProcessingQueue.geometry.GeometryInputParameterSchema);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Print Queue Details</h1>
              <p className="mt-2 text-gray-600">
                View details and manage this print job
              </p>
            </div>
            <Link
              href="/admin/print-queue"
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium"
            >
              ← Back to Print Queue
            </Link>
          </div>
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

        <div className="space-y-6">
          {/* Status and Actions */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900">Print Status</h2>
                <div className="flex items-center gap-4">
                  {getStatusBadge(entry)}
                </div>
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="flex flex-wrap gap-3">
                {!entry.PrintStartedTime && (
                  <button
                    onClick={handleStartPrint}
                    disabled={updating}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm font-medium"
                  >
                    {updating ? 'Starting...' : 'Start Print'}
                  </button>
                )}
                
                {entry.PrintStartedTime && !entry.PrintCompletedTime && (
                  <>
                    <button
                      onClick={handleMarkSuccessful}
                      disabled={updating}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm font-medium"
                    >
                      {updating ? 'Updating...' : 'Mark Successful'}
                    </button>
                    <button
                      onClick={handleMarkFailed}
                      disabled={updating}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm font-medium"
                    >
                      {updating ? 'Updating...' : 'Mark Failed'}
                    </button>
                  </>
                )}

                {entry.PrintCompletedTime && !entry.isPrintSuccessful && (
                  <button
                    onClick={handleMarkSuccessful}
                    disabled={updating}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm font-medium"
                  >
                    {updating ? 'Updating...' : 'Mark Successful'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Print Information */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Print Information</h2>
            </div>
            <div className="px-6 py-4">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Print Queue ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">{entry.id}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Geometry Job ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">
                    <Link 
                      href={`/admin/geometry-jobs/${entry.geometryProcessingQueue.id}`}
                      className="text-blue-600 hover:text-blue-500"
                    >
                      {entry.geometryProcessingQueue.id}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Geometry Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(entry.geometryProcessingQueue.CreationTime)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created By</dt>
                  <dd className="mt-1 text-sm text-gray-900">{entry.geometryProcessingQueue.creator.name || entry.geometryProcessingQueue.creator.email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Organization</dt>
                  <dd className="mt-1 text-sm text-gray-900">{entry.geometryProcessingQueue.owningOrganization.name}</dd>
                </div>
                {entry.PrintStartedTime && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Print Started</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(entry.PrintStartedTime)}</dd>
                  </div>
                )}
                {entry.PrintCompletedTime && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Print Completed</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(entry.PrintCompletedTime)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Files */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Files</h2>
            </div>
            <div className="px-6 py-4">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Geometry File (3MF)</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {entry.hasGeometryFile ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {entry.GeometryFileName || 'geometry.3mf'}
                      </span>
                    ) : (
                      <span className="text-gray-500">Not available</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Print File (GCode)</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {entry.hasPrintFile ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {entry.PrintFileName || 'print.gcode'}
                      </span>
                    ) : (
                      <span className="text-gray-500">Not available</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Customer Information */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Customer Information</h2>
            </div>
            <div className="px-6 py-4">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Customer ID</dt>
                  <dd className="mt-1 text-sm text-gray-900">{entry.geometryProcessingQueue.CustomerID || 'Not specified'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Customer Note</dt>
                  <dd className="mt-1 text-sm text-gray-900">{entry.geometryProcessingQueue.CustomerNote || 'No note provided'}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Geometry Configuration */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Geometry Configuration</h2>
            </div>
            <div className="px-6 py-4">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Geometry Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{entry.geometryProcessingQueue.geometry.GeometryName}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Algorithm</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">{entry.geometryProcessingQueue.geometry.GeometryAlgorithmName}</dd>
                </div>
              </dl>

              {/* Parameter Values */}
              {parameterSchema.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">Parameter Values</h3>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {parameterSchema.map((param: any) => (
                      <div key={param.InputName}>
                        <dt className="text-xs font-medium text-gray-500">{param.InputDescription}</dt>
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}