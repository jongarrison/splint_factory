'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';

interface NamedGeometry {
  id: string;
  GeometryName: string;
  GeometryAlgorithmName: string;
  GeometryInputParameterSchema: string;
  shortDescription: string | null;
  isActive: boolean;
  previewImageUpdatedAt: string | null;
  measurementImageUpdatedAt: string | null;
  CreationTime: string;
  creator: {
    id: string;
    name: string | null;
    email: string;
  };
}

export default function NamedGeometryListPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [geometries, setGeometries] = useState<NamedGeometry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSchemaModal, setShowSchemaModal] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user) {
      router.push('/login');
      return;
    }

    // Check if user is SYSTEM_ADMIN
    const user = session.user as any;
    if (user.role !== 'SYSTEM_ADMIN') {
      router.push('/');
      return;
    }

    fetchGeometries();
  }, [session, status, router]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showSchemaModal) {
        setShowSchemaModal(null);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showSchemaModal]);

  const fetchGeometries = async () => {
    try {
      const response = await fetch('/api/named-geometry');
      if (!response.ok) {
        throw new Error('Failed to fetch geometries');
      }
      const data = await response.json();
      setGeometries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/named-geometry/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete geometry');
      }

      // Refresh the list
      fetchGeometries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete geometry');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatSchema = (schemaJson: string) => {
    try {
      const parsed = JSON.parse(schemaJson);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return schemaJson;
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center dark:text-gray-200">Loading...</div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
          <div className="container mx-auto px-4 py-8">
            <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded">
              Error: {error}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Named Geometry Designs</h1>
        <Link
          href="/admin/named-geometry/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Create New Geometry
        </Link>
      </div>

      {geometries.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No named geometries found.</p>
          <Link
            href="/admin/named-geometry/new"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 mt-2 inline-block"
          >
            Create the first one
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Images
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Schema
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {geometries.map((geometry) => (
                <tr key={geometry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {geometry.GeometryName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {geometry.GeometryAlgorithmName}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">
                      {geometry.shortDescription || <span className="text-gray-400 dark:text-gray-500 italic">No description</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2 text-xs">
                      {geometry.previewImageUpdatedAt ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                          ✓ Preview
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                          No Preview
                        </span>
                      )}
                      {geometry.measurementImageUpdatedAt ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                          ✓ Measure
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                          No Measure
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {geometry.isActive ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => setShowSchemaModal(geometry.id)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 text-sm"
                    >
                      View Schema
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Link
                      href={`/admin/named-geometry/${geometry.id}`}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 mr-4"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/admin/named-geometry/new?copyFrom=${geometry.id}`}
                      className="text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 mr-4"
                    >
                      Copy
                    </Link>
                    <button
                      onClick={() => handleDelete(geometry.id, geometry.GeometryName)}
                      className="text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Schema Modal */}
      {showSchemaModal && (
        <div 
          className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={() => setShowSchemaModal(null)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-96 flex flex-col relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 relative flex-shrink-0">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 pr-8">
                Geometry Input Parameter Schema
              </h3>
              <button
                onClick={() => setShowSchemaModal(null)}
                className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                aria-label="Close modal"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 flex-1 overflow-auto">
              <pre className="display-field whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                {formatSchema(
                  geometries.find(g => g.id === showSchemaModal)?.GeometryInputParameterSchema || ''
                )}
              </pre>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end flex-shrink-0">
              <button
                onClick={() => setShowSchemaModal(null)}
                className="bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-md text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </>
  );
}
