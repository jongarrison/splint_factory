'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';

interface Design {
  id: string;
  name: string;
  algorithmName: string;
  inputParameterSchema: string;
  shortDescription: string | null;
  isActive: boolean;
  previewImageUpdatedAt: string | null;
  measurementImageUpdatedAt: string | null;
  createdAt: string;
  creator: {
    id: string;
    name: string | null;
    email: string;
  };
}

export default function DesignListPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

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

  const fetchGeometries = async () => {
    try {
      const response = await fetch('/api/admin/design-definitions?all=true');
      if (!response.ok) {
        throw new Error('Failed to fetch designs');
      }
      const data = await response.json();
      setDesigns(data);
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
      const response = await fetch(`/api/admin/design-definitions/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete design');
      }

      fetchGeometries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete design');
    }
  };

  const handleDownloadSchema = (design: Design) => {
    // Pretty-print the schema JSON for readability
    let content: string;
    try {
      content = JSON.stringify(JSON.parse(design.inputParameterSchema), null, 2);
    } catch {
      content = design.inputParameterSchema;
    }
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${design.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadSchema = async (id: string, file: File) => {
    setUploadingId(id);
    setError(null);
    try {
      const text = await file.text();
      // Validate it parses as JSON before sending
      JSON.parse(text);

      const response = await fetch(`/api/admin/design-definitions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputParameterSchema: text }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload schema');
      }

      // Refresh the list to pick up the updated schema
      fetchGeometries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload schema');
    } finally {
      setUploadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="page-shell" data-testid="design-definitions-loading">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-primary">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-shell">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="alert-error">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell" data-testid="design-definitions-page">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="page-title">Design Definitions</h1>
          <Link
            href="/admin/design-definitions/new"
            className="btn-primary px-4 py-2 text-sm"
            data-testid="create-design-btn"
          >
            Create New Design
          </Link>
        </div>

        {designs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted">No named designs found.</p>
            <Link
              href="/admin/design-definitions/new"
              className="text-link mt-2 inline-block"
            >
              Create the first one
            </Link>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="data-table" data-testid="designs-table">
              <thead>
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {designs.map((design) => (
                  <tr key={design.id} data-testid="design-row" data-design-id={design.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/admin/design-definitions/${design.id}`}
                        title={design.shortDescription || undefined}
                        className="flex items-center gap-3"
                      >
                        {design.previewImageUpdatedAt ? (
                          <img
                            src={`/api/design-images/${design.id}/preview`}
                            alt={design.name}
                            className="w-20 h-20 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded bg-[var(--surface-secondary)] flex-shrink-0" />
                        )}
                        <div>
                          <div className="text-sm font-medium text-primary">
                            {design.name}
                          </div>
                          <div className="text-xs text-muted">
                            {design.algorithmName}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`status-badge ${
                        design.isActive ? 'status-success' : 'status-neutral'
                      }`} data-testid="design-status-badge">
                        {design.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Download schema */}
                        <button
                          onClick={() => handleDownloadSchema(design)}
                          title="Download schema"
                          className="p-1.5 rounded text-muted hover:text-[var(--accent-blue)] hover:bg-[var(--surface-secondary)]"
                          data-testid="download-schema-btn"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
                          </svg>
                        </button>
                        {/* Upload schema */}
                        <label
                          title="Upload schema"
                          className={`p-1.5 rounded cursor-pointer text-muted hover:text-[var(--accent-blue)] hover:bg-[var(--surface-secondary)] ${uploadingId === design.id ? 'opacity-50 pointer-events-none' : ''}`}
                          data-testid="upload-schema-btn"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M17 8l-5-5m0 0L7 8m5-5v12" />
                          </svg>
                          <input
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadSchema(design.id, file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                        {/* Edit */}
                        <Link
                          href={`/admin/design-definitions/${design.id}`}
                          title="Edit"
                          className="p-1.5 rounded text-muted hover:text-[var(--accent-blue)] hover:bg-[var(--surface-secondary)]"
                          data-testid="edit-design-btn"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </Link>
                        {/* Copy */}
                        <Link
                          href={`/admin/design-definitions/new?copyFrom=${design.id}`}
                          title="Copy"
                          className="p-1.5 rounded text-muted hover:text-[var(--status-success-text)] hover:bg-[var(--surface-secondary)]"
                          data-testid="copy-design-btn"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </Link>
                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(design.id, design.name)}
                          title="Delete"
                          className="p-1.5 rounded text-muted hover:text-[var(--status-error-text)] hover:bg-[var(--surface-secondary)]"
                          data-testid="delete-design-btn"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
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
  );
}
