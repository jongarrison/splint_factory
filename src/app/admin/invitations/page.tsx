'use client'

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';

interface InvitationLink {
  id: string;
  token: string;
  email: string | null;
  expiresAt: string;
  usedAt: string | null;
  organizationId: string;
  organization: {
    id: string;
    name: string;
  };
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
  createdAt: string;
}

interface Organization {
  id: string;
  name: string;
}

export default function InvitationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [invitations, setInvitations] = useState<InvitationLink[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
    // Form state
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | ''>(7);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user) {
      router.push('/login');
      return;
    }

    fetchData();
  }, [session, status, router]);

  const fetchData = () => {
    Promise.all([
      fetch('/api/invitations').then(res => res.json()),
      fetch('/api/organizations').then(res => res.json())
    ])
      .then(([invitationsData, orgsData]) => {
        if (invitationsData.error) {
          throw new Error(invitationsData.error);
        }
        if (orgsData.error) {
          throw new Error(orgsData.error);
        }
        setInvitations(invitationsData);
        setOrganizations(orgsData);
      })
      .catch(err => {
        console.error('Error fetching data:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  };

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          expiresInDays: expiresInDays || 7,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create invitation');
      }

      setInvitations([data, ...invitations]);
      setShowCreateForm(false);
            // Reset form
      setSelectedOrgId('');
      setExpiresInDays(7);
    } catch (err: unknown) {
      console.error('Error creating invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to create invitation');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInvitationUrl = (token: string) => {
    return `${window.location.origin}/register?invitation=${token}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      // Check if navigator.clipboard is available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        console.log('Copied to clipboard successfully');
        return;
      }
      
      // Fallback method for older browsers or insecure contexts
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        console.log('Copied to clipboard successfully (fallback method)');
      } else {
        throw new Error('Fallback copy method failed');
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Show user feedback that copy failed
      alert('Failed to copy to clipboard. Please copy the URL manually.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading invitations...</p>
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
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Invitation Management</h1>
              <p className="text-gray-600 mt-2">Create and manage invitation links for your organization</p>
            </div>
            <div className="flex gap-4">
              <Link 
                href="/admin" 
                className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                ← Back to Admin
              </Link>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                {showCreateForm ? 'Cancel' : 'Create Invitation'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
            <button 
              onClick={() => setError('')}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <div className="mb-8 bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Invitation</h2>
            <form onSubmit={handleCreateInvitation} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="organization" className="block text-sm font-medium text-gray-700 mb-2">
                    Organization
                  </label>
                  <select
                    id="organization"
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Organization</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="expiresInDays" className="block text-sm font-medium text-gray-700 mb-2">
                    Expires In (Days)
                  </label>
                  <input
                    type="number"
                    id="expiresInDays"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : '')}
                    className="w-full p-3 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="7"
                    min="1"
                    max="365"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? 'Creating...' : 'Create Invitation'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Invitations List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Invitation Links ({invitations.length})
            </h2>
          </div>

          {invitations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="mb-4">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <p className="text-lg">No invitation links created yet</p>
              <p className="text-sm">Create your first invitation link to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {invitations.map((invitation) => {
                const invitationUrl = getInvitationUrl(invitation.token);
                const isExpired = new Date(invitation.expiresAt) < new Date();
                const isUsed = !!invitation.usedAt;
                
                return (
                  <div key={invitation.id} className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            {invitation.organization.name}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            isUsed ? 'bg-gray-100 text-gray-800' :
                            isExpired ? 'bg-red-100 text-red-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {isUsed ? 'Used' : isExpired ? 'Expired' : 'Active'}
                          </span>
                        </div>
                        
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>Created by: {invitation.createdBy.name || invitation.createdBy.email}</div>
                          <div>Created: {formatDate(invitation.createdAt)}</div>
                          <div>Expires: {formatDate(invitation.expiresAt)}</div>
                          {invitation.usedAt && (
                            <div>Used: {formatDate(invitation.usedAt)}</div>
                          )}
                        </div>
                        
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            type="text"
                            value={invitationUrl}
                            readOnly
                            className="flex-1 p-2 text-sm bg-gray-50 border border-gray-300 rounded font-mono text-gray-900"
                          />
                          <button
                            onClick={() => copyToClipboard(invitationUrl)}
                            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
