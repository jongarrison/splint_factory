'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';

interface Organization {
  id: string;
  name: string;
}

interface ApiKeyFormData {
  name: string;
  organizationId: string;
  permissions: string[];
  isActive: boolean;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function ApiKeyFormPage({ params }: Props) {
  const router = useRouter();
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [formData, setFormData] = useState<ApiKeyFormData>({
    name: '',
    organizationId: '',
    permissions: [],
    isActive: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);

  // Available permissions
  const availablePermissions = [
    { id: 'geometry-queue:read', label: 'Geometry Queue - Read', category: 'Geometry Queue' },
    { id: 'geometry-queue:write', label: 'Geometry Queue - Write', category: 'Geometry Queue' },
    { id: 'print-queue:read', label: 'Print Queue - Read', category: 'Print Queue' },
    { id: 'print-queue:write', label: 'Print Queue - Write', category: 'Print Queue' },
    { id: 'print-queue:create', label: 'Print Queue - Create', category: 'Print Queue' }
  ];

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  useEffect(() => {
    if (resolvedParams) {
      fetchOrganizations();
      if (resolvedParams.id !== 'new') {
        fetchApiKey();
      } else {
        setLoading(false);
      }
    }
  }, [resolvedParams]);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/organizations');
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data);
      }
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
    }
  };

  const fetchApiKey = async () => {
    if (!resolvedParams || resolvedParams.id === 'new') return;

    try {
      setLoading(true);
      const response = await fetch(`/api/api-keys/${resolvedParams.id}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch API key');
      }
      
      const data = await response.json();
      setFormData({
        name: data.name,
        organizationId: data.organizationId || '',
        permissions: data.permissions,
        isActive: data.isActive
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      permissions: checked 
        ? [...prev.permissions, permissionId]
        : prev.permissions.filter(p => p !== permissionId)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    if (formData.permissions.length === 0) {
      setError('At least one permission is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const url = resolvedParams?.id === 'new' 
        ? '/api/api-keys'
        : `/api/api-keys/${resolvedParams?.id}`;
      
      const method = resolvedParams?.id === 'new' ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          organizationId: formData.organizationId || null,
          permissions: formData.permissions,
          isActive: formData.isActive
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${resolvedParams?.id === 'new' ? 'create' : 'update'} API key`);
      }

      const data = await response.json();
      
      if (resolvedParams?.id === 'new' && data.apiKey) {
        setGeneratedApiKey(data.apiKey);
        setSuccess('API key created successfully! Make sure to copy the key below - it will not be shown again.');
      } else {
        setSuccess('API key updated successfully');
        setTimeout(() => {
          router.push('/admin/api-keys');
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess('API key copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="text-center">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  const isEditing = resolvedParams?.id !== 'new';
  const pageTitle = isEditing ? 'Edit API Key' : 'Create API Key';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link 
              href="/admin/api-keys"
              className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
            >
              ← Back to API Keys
            </Link>
          </div>

          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h1 className="text-2xl font-semibold text-gray-900 mb-6">{pageTitle}</h1>

              {error && (
                <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                  {success}
                </div>
              )}

              {generatedApiKey && (
                <div className="mb-6 bg-yellow-50 border border-yellow-400 p-4 rounded">
                  <h3 className="text-lg font-medium text-yellow-800 mb-2">Your API Key</h3>
                  <p className="text-sm text-yellow-700 mb-3">
                    This is the only time you will see this key. Make sure to copy it now!
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-100 px-3 py-2 rounded font-mono text-sm flex-1 overflow-x-auto">
                      {generatedApiKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(generatedApiKey)}
                      className="px-3 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="mt-4">
                    <Link
                      href="/admin/api-keys"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                    >
                      Done
                    </Link>
                  </div>
                </div>
              )}

              {!generatedApiKey && (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      placeholder="e.g., Geometry Processor v1.2"
                      maxLength={250}
                      required
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      A descriptive name for this API key (max 250 characters)
                    </p>
                  </div>

                  <div>
                    <label htmlFor="organizationId" className="block text-sm font-medium text-gray-700">
                      Organization
                    </label>
                    <select
                      id="organizationId"
                      value={formData.organizationId}
                      onChange={(e) => setFormData(prev => ({ ...prev, organizationId: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      <option value="">All Organizations</option>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-sm text-gray-500">
                      Leave empty to allow access to all organizations
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Permissions *
                    </label>
                    <div className="space-y-4">
                      {Object.entries(
                        availablePermissions.reduce((acc, perm) => {
                          if (!acc[perm.category]) acc[perm.category] = [];
                          acc[perm.category].push(perm);
                          return acc;
                        }, {} as Record<string, typeof availablePermissions>)
                      ).map(([category, perms]) => (
                        <div key={category}>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">{category}</h4>
                          <div className="space-y-2">
                            {perms.map((permission) => (
                              <div key={permission.id} className="flex items-center">
                                <input
                                  id={permission.id}
                                  type="checkbox"
                                  checked={formData.permissions.includes(permission.id)}
                                  onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                />
                                <label htmlFor={permission.id} className="ml-3 text-sm text-gray-700">
                                  {permission.label}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      Select the permissions this API key should have
                    </p>
                  </div>

                  <div className="flex items-center">
                    <input
                      id="isActive"
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isActive" className="ml-3 text-sm text-gray-700">
                      Active
                    </label>
                    <p className="ml-3 text-sm text-gray-500">
                      Uncheck to create the API key in a disabled state
                    </p>
                  </div>

                  <div className="flex justify-end gap-3">
                    <Link
                      href="/admin/api-keys"
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? 'Saving...' : (isEditing ? 'Update' : 'Create')} API Key
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
