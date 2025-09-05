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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center">Loading...</div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="container mx-auto px-4 py-8">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Named Geometry Designs</h1>
        <Link
          href="/admin/named-geometry/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Create New Geometry
        </Link>
      </div>

      {geometries.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No named geometries found.</p>
          <Link
            href="/admin/named-geometry/new"
            className="text-blue-600 hover:text-blue-500 mt-2 inline-block"
          >
            Create the first one
          </Link>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Algorithm
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Schema
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Creator
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
              {geometries.map((geometry) => (
                <tr key={geometry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {geometry.GeometryName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {geometry.GeometryAlgorithmName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => setShowSchemaModal(geometry.id)}
                      className="text-blue-600 hover:text-blue-500 text-sm"
                    >
                      View Schema
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {geometry.creator.name || geometry.creator.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {formatDate(geometry.CreationTime)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Link
                      href={`/admin/named-geometry/${geometry.id}`}
                      className="text-blue-600 hover:text-blue-500 mr-4"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(geometry.id, geometry.GeometryName)}
                      className="text-red-600 hover:text-red-500"
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
          className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowSchemaModal(null)}
        >
          <div 
            className="bg-white rounded-lg max-w-2xl w-full max-h-96 flex flex-col relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 relative flex-shrink-0">
              <h3 className="text-lg font-medium text-gray-900 pr-8">
                Geometry Input Parameter Schema
              </h3>
              <button
                onClick={() => setShowSchemaModal(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label="Close modal"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 flex-1 overflow-auto">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                {formatSchema(
                  geometries.find(g => g.id === showSchemaModal)?.GeometryInputParameterSchema || ''
                )}
              </pre>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end flex-shrink-0">
              <button
                onClick={() => setShowSchemaModal(null)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
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
