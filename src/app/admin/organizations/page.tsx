'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/navigation/Header';

interface Organization {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  _count: {
    users: number;
  };
}

export default function AdminPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDescription, setNewOrgDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/organizations');
      if (!response.ok) {
        throw new Error('Failed to fetch organizations');
      }
      const data = await response.json();
      setOrganizations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const createOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    setCreating(true);
    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newOrgName.trim(),
          description: newOrgDescription.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create organization');
      }

      // Reset form and refresh list
      setNewOrgName('');
      setNewOrgDescription('');
      setShowCreateForm(false);
      fetchOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  if (loading) {
    return (
      <div className="page-shell" data-testid="admin-organizations-loading">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-primary">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell" data-testid="admin-organizations-page">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="page-title">Organization Management</h1>
          <p className="mt-2 text-secondary">
            Phase 1: Basic organization management (System admin features)
          </p>
        </div>

        {error && (
          <div className="alert-error mb-6 flex items-center justify-between" data-testid="alert-error">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-2 hover:opacity-70"
              data-testid="dismiss-error-btn"
            >
              x
            </button>
          </div>
        )}

        <div className="card" data-testid="organizations-card">
          <div className="card-header flex justify-between items-center">
            <h2 className="text-lg font-medium text-primary">Organizations</h2>
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary px-4 py-2 text-sm"
              data-testid="create-org-btn"
            >
              Create Organization
            </button>
          </div>

          {showCreateForm && (
            <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-secondary)]" data-testid="create-org-form">
              <form onSubmit={createOrganization}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-secondary">
                      Organization Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      className="input-field mt-1 text-sm"
                      placeholder="Enter organization name"
                      required
                      data-testid="org-name-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-secondary">
                      Description
                    </label>
                    <input
                      type="text"
                      id="description"
                      value={newOrgDescription}
                      onChange={(e) => setNewOrgDescription(e.target.value)}
                      className="input-field mt-1 text-sm"
                      placeholder="Optional description"
                      data-testid="org-desc-input"
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="submit"
                    disabled={creating}
                    className="btn-success px-4 py-2 text-sm"
                    data-testid="create-submit-btn"
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewOrgName('');
                      setNewOrgDescription('');
                    }}
                    className="btn-neutral px-4 py-2 text-sm"
                    data-testid="create-cancel-btn"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="data-table" data-testid="organizations-table">
              <thead>
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3">Members</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Created</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => (
                  <tr key={org.id} data-testid="org-row" data-org-id={org.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => router.push(`/admin/organizations/${org.id}`)}
                        className="text-sm font-medium text-link hover:underline"
                      >
                        {org.name}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-muted">{org.description || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-primary">{org._count.users}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`status-badge ${
                        org.isActive ? 'status-success' : 'status-error'
                      }`} data-testid="org-status-badge">
                        {org.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => router.push(`/admin/organizations/${org.id}/edit`)}
                        className="text-link hover:underline"
                        data-testid="edit-org-btn"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
