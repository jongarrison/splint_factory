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
  };
}

export default function PrintQueuePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [printQueue, setPrintQueue] = useState<PrintQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isElectronClient, setIsElectronClient] = useState(false);
  const [printingJobId, setPrintingJobId] = useState<string | null>(null);

  const fetchPrintQueue = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/print-queue');
      if (!response.ok) {
        throw new Error('Failed to fetch print queue');
      }
      const data = await response.json();
      setPrintQueue(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Detect if running in Electron client
    setIsElectronClient(typeof window !== 'undefined' && !!(window as any).electronAPI);
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user) {
      router.push('/login');
      return;
    }

    fetchPrintQueue();
  }, [session, status, router]);

  const getStatusBadge = (entry: PrintQueueEntry) => {
    if (entry.PrintCompletedTime && entry.isPrintSuccessful) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Print Successful</span>;
    }
    if (entry.PrintCompletedTime && !entry.isPrintSuccessful) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Print Failed</span>;
    }
    if (entry.PrintStartedTime) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Printing</span>;
    }
    return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Ready to Print</span>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleMarkPrintSuccessful = async (entryId: string) => {
    try {
      const response = await fetch(`/api/print-queue/${entryId}`, {
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
        throw new Error('Failed to update print status');
      }

      // Refresh the list
      fetchPrintQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update print status');
    }
  };

  const handleStartPrint = async (entryId: string) => {
    try {
      const response = await fetch(`/api/print-queue/${entryId}`, {
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

      // Refresh the list
      fetchPrintQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start print');
    }
  };

  const handlePrint = async (entry: PrintQueueEntry) => {
    if (!isElectronClient) {
      setError('Printing is only available in the Electron client');
      return;
    }

    try {
      setPrintingJobId(entry.id);
      setError(null);

      // Get the geometry processing queue ID to download the print file
      const geometryJobId = entry.geometryProcessingQueue.id;
      
      // Get session cookie for authentication
      const sessionCookie = document.cookie;
      
      // Generate a job name from the geometry and customer info
      const jobName = `${entry.geometryProcessingQueue.geometry.GeometryName.replace(/\s+/g, '_')}_${entry.geometryProcessingQueue.CustomerID || 'customer'}`;

      // Call the Electron API to print
      const electronAPI = (window as any).electronAPI;
      const result = await electronAPI.printing.printGeometryJob(
        geometryJobId,
        sessionCookie,
        jobName
      );

      if (!result.success) {
        throw new Error(result.error || 'Print failed');
      }

      // Update the print queue entry to mark as started
      await fetch(`/api/print-queue/${entry.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          PrintStartedTime: new Date().toISOString(),
        }),
      });

      // Refresh the list
      await fetchPrintQueue();
      
      alert(`Print job "${result.jobName}" started successfully!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start print');
      console.error('Print error:', err);
    } finally {
      setPrintingJobId(null);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this print job? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/print-queue/${entryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isEnabled: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete print job');
      }

      // Refresh the list (the deleted entry will be filtered out)
      fetchPrintQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete print job');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header variant={isElectronClient ? 'electron' : 'browser'} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading print queue...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header variant={isElectronClient ? 'electron' : 'browser'} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Print Queue</h1>
              <p className="mt-2 text-gray-600">
                Manage 3D print jobs ready for printing.
              </p>
            </div>
            {isElectronClient && (
              <div className="bg-purple-100 border border-purple-300 text-purple-800 px-4 py-2 rounded-lg flex items-center space-x-2">
                <span className="text-2xl">🖨️</span>
                <div>
                  <div className="font-semibold text-sm">Printer Client Active</div>
                  <div className="text-xs">Direct printing enabled</div>
                </div>
              </div>
            )}
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

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Active Print Jobs</h2>
            <button
              onClick={fetchPrintQueue}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium"
            >
              Refresh
            </button>
          </div>
          
          <div className="overflow-x-auto">
            {printQueue.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-500 text-lg">No print jobs in queue</div>
                <p className="text-gray-400 mt-2">Print jobs will appear here after geometry processing is completed.</p>
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
                        Files
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {printQueue.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {entry.geometryProcessingQueue.geometry.GeometryName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {entry.geometryProcessingQueue.geometry.GeometryAlgorithmName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {entry.geometryProcessingQueue.CustomerID ? 
                              `ID: ${entry.geometryProcessingQueue.CustomerID}` : 'No ID'}
                          </div>
                          {entry.geometryProcessingQueue.CustomerNote && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {entry.geometryProcessingQueue.CustomerNote}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex flex-col space-y-1">
                            {entry.hasGeometryFile && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                3MF: {entry.GeometryFileName || 'geometry.3mf'}
                              </span>
                            )}
                            {entry.hasPrintFile && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                GCode: {entry.PrintFileName || 'print.gcode'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(entry)}
                          {entry.PrintStartedTime && (
                            <div className="text-xs text-gray-500 mt-1">
                              Started: {formatDate(entry.PrintStartedTime)}
                            </div>
                          )}
                          {entry.PrintCompletedTime && (
                            <div className="text-xs text-gray-500 mt-1">
                              Completed: {formatDate(entry.PrintCompletedTime)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex flex-col space-y-2">
                            {/* Print button - shows for all users but only enabled in Electron client */}
                            {!entry.PrintStartedTime && entry.hasPrintFile && (
                              <div className="relative group">
                                <button
                                  onClick={() => isElectronClient ? handlePrint(entry) : null}
                                  disabled={!isElectronClient || printingJobId === entry.id}
                                  className={`${
                                    !isElectronClient || printingJobId === entry.id
                                      ? 'bg-gray-400 cursor-not-allowed'
                                      : 'bg-purple-600 hover:bg-purple-700'
                                  } text-white px-3 py-1 rounded text-xs font-semibold w-full`}
                                  title={!isElectronClient ? 'This feature only works from the 3D printer\'s splint computer' : ''}
                                >
                                  {printingJobId === entry.id ? 'Printing...' : '🖨️ Print'}
                                </button>
                                {!isElectronClient && (
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                                    <div className="relative">
                                      This feature only works from the 3D printer's splint computer
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {entry.PrintCompletedTime && !entry.isPrintSuccessful && (
                              <button
                                onClick={() => handleMarkPrintSuccessful(entry.id)}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs"
                              >
                                Mark Successful
                              </button>
                            )}
                            <Link
                              href={`/admin/print-queue/${entry.id}`}
                              className="text-blue-600 hover:text-blue-900 text-xs"
                            >
                              View Details
                            </Link>
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs"
                            >
                              Delete
                            </button>
                          </div>
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