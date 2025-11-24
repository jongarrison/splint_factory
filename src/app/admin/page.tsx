'use client';

import { useState, useEffect } from 'react';
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center dark:text-gray-200">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Organization Management</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Phase 1: Basic organization management (System admin features)
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded">
            {error}
            <button 
              onClick={() => setError(null)}
              className="ml-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            >
              ✕
            </button>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Organizations</h2>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
            >
              Create Organization
            </button>
          </div>

          {showCreateForm && (
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <form onSubmit={createOrganization}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Organization Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter organization name"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Description
                    </label>
                    <input
                      type="text"
                      id="description"
                      value={newOrgDescription}
                      onChange={(e) => setNewOrgDescription(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional description"
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="submit"
                    disabled={creating}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white px-4 py-2 rounded text-sm font-medium"
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
                    className="bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 px-4 py-2 rounded text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="overflow-x-auto">
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
                    Members
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {organizations.map((org) => (
                  <tr key={org.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{org.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 dark:text-gray-400">{org.description || '—'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">{org._count.users}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        org.isActive 
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                          : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                      }`}>
                        {org.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(org.createdAt).toLocaleDateString()}
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
