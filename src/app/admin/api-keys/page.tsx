'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/navigation/Header';

interface ApiKey {
  id: string;
  name: string;
  permissions: string[];
  organizationId: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  organization?: {
    name: string;
  };
  creator: {
    name: string | null;
    email: string;
  };
}

export default function ApiKeysListPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/api-keys');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch API keys');
      }
      
      const data = await response.json();
      setApiKeys(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this API key? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/api-keys/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete API key');
      }

      // Refresh the list
      fetchApiKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    }
  };

  const maskApiKey = (keyId: string) => {
    return `ak_${'*'.repeat(8)}${keyId.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="page-shell" data-testid="api-keys-loading">
        <Header />
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="text-center text-secondary">Loading API keys...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-shell">
        <Header />
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="alert-error" data-testid="alert-error">
            Error: {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell" data-testid="api-keys-page">
      <Header />
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:items-center mb-8">
          <div className="sm:flex-auto">
            <h1 className="page-title">API Keys</h1>
            <p className="mt-2 text-sm text-muted">
              Manage API keys for external system access to the application.
            </p>
          </div>
          <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
            <Link
              href="/admin/api-keys/new"
              className="btn-primary px-3 py-2 text-sm"
              data-testid="create-api-key-btn"
            >
              Create API Key
            </Link>
          </div>
        </div>

        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Key ID</th>
                <th>Organization</th>
                <th>Permissions</th>
                <th>Status</th>
                <th>Last Used</th>
                <th>Created</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-muted">
                    No API keys found.
                    <Link href="/admin/api-keys/new" className="text-link hover:underline ml-1">
                      Create your first API key
                    </Link>
                  </td>
                </tr>
              ) : (
                apiKeys.map((apiKey) => (
                  <tr key={apiKey.id}>
                    <td className="whitespace-nowrap text-sm font-medium text-primary">
                      {apiKey.name}
                    </td>
                    <td className="whitespace-nowrap text-sm text-muted font-mono">
                      {maskApiKey(apiKey.id)}
                    </td>
                    <td className="whitespace-nowrap text-sm text-muted">
                      {apiKey.organization?.name || 'All Organizations'}
                    </td>
                    <td className="text-sm">
                      <div className="flex flex-wrap gap-1">
                        {apiKey.permissions.map((permission, index) => (
                          <span
                            key={index}
                            className="status-badge status-neutral"
                          >
                            {permission}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-sm">
                      <span className={`status-badge ${
                        apiKey.isActive ? 'status-success' : 'status-error'
                      }`}>
                        {apiKey.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-sm text-muted">
                      {apiKey.lastUsedAt
                        ? new Date(apiKey.lastUsedAt).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="whitespace-nowrap text-sm text-muted">
                      {new Date(apiKey.createdAt).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/api-keys/${apiKey.id}`}
                          className="text-link hover:underline"
                          data-testid="edit-key-link"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(apiKey.id)}
                          className="text-[var(--status-error-text)] hover:opacity-80"
                          data-testid="delete-key-btn"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
