'use client'

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';

interface InvitationLink {
  id: string;
  token: string;
  email: string | null;
  emailAcceptedAt: string | null;
  emailProviderId: string | null;
  emailLastError: string | null;
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
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [copiedInvitationId, setCopiedInvitationId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [organizationFilter, setOrganizationFilter] = useState('');
  const [emailSearch, setEmailSearch] = useState('');
  const [appliedEmailSearch, setAppliedEmailSearch] = useState('');
  
    // Form state
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | ''>(7);
  const [inviteEmail, setInviteEmail] = useState('');

  const isSystemAdmin = session?.user?.role === 'SYSTEM_ADMIN';

  const fetchData = useCallback(() => {
    const params = new URLSearchParams();
    if (isSystemAdmin && organizationFilter) {
      params.set('organizationId', organizationFilter);
    }
    if (appliedEmailSearch) {
      params.set('email', appliedEmailSearch);
    }
    const query = params.size > 0 ? `?${params.toString()}` : '';

    setLoading(true);
    Promise.all([
      fetch(`/api/invitations${query}`).then(res => res.json()),
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
  }, [appliedEmailSearch, isSystemAdmin, organizationFilter]);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session?.user) {
      router.push('/login');
      return;
    }

    if (!organizationFilter) {
      const defaultOrganizationFilter = session.user.organizationId || (isSystemAdmin ? 'all' : '');
      if (defaultOrganizationFilter) {
        setOrganizationFilter(defaultOrganizationFilter);
        return;
      }
    }

    fetchData();
  }, [fetchData, isSystemAdmin, organizationFilter, router, session, status]);

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const emails = Array.from(new Map(
        inviteEmail
          .split(/[\s,]+/)
          .map(email => email.trim())
          .filter(Boolean)
          .map(email => [email.toLowerCase(), email])
      ).values());
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          expiresInDays: expiresInDays || 7,
          ...(emails.length > 0 ? { emails } : {}),
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create invitation');
      }

      setShowCreateForm(false);
      setSelectedOrgId('');
      setExpiresInDays(7);
      setInviteEmail('');
      fetchData();
    } catch (err: unknown) {
      console.error('Error creating invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to create invitation');
    } finally {
      setCreating(false);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    setResendingId(invitationId);
    setError('');

    try {
      const response = await fetch(`/api/invitations/${invitationId}/resend`, {
        method: 'POST',
      });
      const data = await response.json();
      const updatedInvitation = data.invitation || data;

      if (updatedInvitation.id) {
        setInvitations(current => current.map(invitation =>
          invitation.id === invitationId
            ? { ...invitation, ...updatedInvitation }
            : invitation
        ));
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend invitation email');
      }
    } catch (err: unknown) {
      console.error('Error resending invitation:', err);
      setError(err instanceof Error ? err.message : 'Failed to resend invitation email');
    } finally {
      setResendingId(null);
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

  const copyToClipboard = async (text: string, invitationId: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
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

        if (!successful) {
          throw new Error('Fallback copy method failed');
        }
      }

      setCopiedInvitationId(invitationId);
      window.setTimeout(() => {
        setCopiedInvitationId(current => current === invitationId ? null : current);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      alert('Failed to copy to clipboard. Please copy the URL manually.');
    }
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setAppliedEmailSearch(emailSearch.trim());
  };

  const visibleInvitations = invitations.filter(
    invitation => showAll || (!invitation.usedAt && new Date(invitation.expiresAt) >= new Date())
  );
  const availableOrganizations = isSystemAdmin
    ? organizations
    : organizations.filter(organization => organization.id === session?.user?.organizationId);

  if (loading) {
    return (
      <div className="page-shell" data-testid="invitations-loading">
        <Header />
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-muted">Loading invitations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell" data-testid="invitations-page">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="page-title">User Invitation Management</h1>
              <p className="text-muted mt-2">Create and manage user invitation links</p>
            </div>
            <div className="flex gap-4">
              <Link 
                href="/admin/organizations" 
                className="btn-neutral px-4 py-2"
              >
                ← Back to Admin
              </Link>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="btn-primary px-4 py-2"
                data-testid="create-invitation-btn"
              >
                {showCreateForm ? 'Cancel' : 'Create Invitation'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="alert-error mb-6" data-testid="alert-error">
            {error}
            <button 
              onClick={() => setError('')}
              className="ml-2 text-[var(--status-error-text)] hover:opacity-80"
            >
              ✕
            </button>
          </div>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <div className="card p-6 mb-8">
            <h2 className="text-xl font-semibold text-primary mb-4">Create New Invitation</h2>
            <form onSubmit={handleCreateInvitation} className="space-y-4">
              <div>
                <label htmlFor="inviteEmail" className="block text-sm font-medium text-secondary mb-2">
                  Email Addresses (optional)
                </label>
                <textarea
                  id="inviteEmail"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="input-field text-sm min-h-32"
                  data-testid="invite-email-input"
                  placeholder={'user@example.com\nsecond@example.com'}
                />
                <p className="mt-1 text-xs text-muted">
                  Separate addresses with commas or whitespace. Each address receives its own invitation for the selected organization. If left blank, you can copy one invitation link manually.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="organization" className="block text-sm font-medium text-secondary mb-2">
                    Organization
                  </label>
                  <select
                    id="organization"
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="input-field text-sm"
                    data-testid="org-select"
                    required
                  >
                    <option value="">Select Organization</option>
                    {availableOrganizations.map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="expiresInDays" className="block text-sm font-medium text-secondary mb-2">
                    Expires In (Days)
                  </label>
                  <input
                    type="number"
                    id="expiresInDays"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : '')}
                    className="input-field text-sm"
                    data-testid="expires-days-input"
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
                  className="btn-neutral px-4 py-2"
                  data-testid="form-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary px-4 py-2"
                  data-testid="form-submit-btn"
                >
                  {creating ? 'Creating...' : 'Create Invitation(s)'}
                </button>
              </div>
            </form>
          </div>
        )}

        <form onSubmit={handleSearch} className="card p-6 mb-8">
          <div className={`grid grid-cols-1 gap-4 ${isSystemAdmin ? 'md:grid-cols-2' : ''}`}>
            {isSystemAdmin && (
              <div>
                <label htmlFor="organizationFilter" className="block text-sm font-medium text-secondary mb-2">
                  Organization
                </label>
                <select
                  id="organizationFilter"
                  value={organizationFilter}
                  onChange={(event) => setOrganizationFilter(event.target.value)}
                  className="input-field text-sm"
                  data-testid="organization-filter"
                >
                  <option value="all">All orgs</option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="emailSearch" className="block text-sm font-medium text-secondary mb-2">
                Search email
              </label>
              <div className="flex gap-2">
                <input
                  id="emailSearch"
                  type="search"
                  value={emailSearch}
                  onChange={(event) => setEmailSearch(event.target.value)}
                  className="input-field text-sm"
                  placeholder="Partial email address"
                  data-testid="email-search"
                />
                <button type="submit" className="btn-primary px-4 py-2">
                  Search
                </button>
                {appliedEmailSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setEmailSearch('');
                      setAppliedEmailSearch('');
                    }}
                    className="btn-neutral px-4 py-2"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>

        <div className="card">
          <div className="px-6 py-4 border-b border-[var(--border)] flex justify-between items-center">
            <h2 className="text-xl font-semibold text-primary">
              {showAll ? 'All' : 'Active'} Invitations ({visibleInvitations.length})
            </h2>
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-sm text-link hover:underline"
              data-testid="toggle-show-all-btn"
            >
              {showAll ? 'Show active only' : 'Show all'}
            </button>
          </div>

          {visibleInvitations.length === 0 ? (
            <div className="p-8 text-center text-muted">
              <div className="mb-4">
                <svg className="mx-auto h-12 w-12 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <p className="text-lg">No matching invitations</p>
              <p className="text-sm">
                {showAll ? 'Try changing the organization or email search.' : 'Try changing the filters or showing invitation history.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {visibleInvitations.map((invitation) => {
                const invitationUrl = getInvitationUrl(invitation.token);
                const isExpired = new Date(invitation.expiresAt) < new Date();
                const isUsed = !!invitation.usedAt;
                
                return (
                  <div key={invitation.id} className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-medium text-primary">
                            {invitation.organization.name}
                          </span>
                          <span className={`status-badge ${
                            isUsed ? 'status-neutral' :
                            isExpired ? 'status-error' :
                            'status-success'
                          }`}>
                            {isUsed ? 'Used' : isExpired ? 'Expired' : 'Active'}
                          </span>
                        </div>
                        
                        <div className="text-sm text-muted space-y-1">
                          {invitation.email && (
                            <div>Invited: <span className="font-medium text-primary">{invitation.email}</span></div>
                          )}
                          <div>Created by: {invitation.createdBy.name || invitation.createdBy.email}</div>
                          <div>Created: {formatDate(invitation.createdAt)}</div>
                          <div>Expires: {formatDate(invitation.expiresAt)}</div>
                          {invitation.usedAt && (
                            <div>Used: {formatDate(invitation.usedAt)}</div>
                          )}
                        </div>
                        
                        {invitation.email && (
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                            <span className={invitation.emailAcceptedAt ? 'text-[var(--status-success-text)]' : invitation.emailLastError ? 'text-[var(--status-error-text)]' : 'text-muted'}>
                              {invitation.emailAcceptedAt
                                ? `Accepted by Resend: ${formatDate(invitation.emailAcceptedAt)}`
                                : invitation.emailLastError
                                  ? `Email not accepted: ${invitation.emailLastError}`
                                  : 'Email delivery not confirmed'}
                            </span>
                            {!isUsed && !isExpired && (
                              <button
                                onClick={() => handleResendInvitation(invitation.id)}
                                disabled={resendingId === invitation.id}
                                className="btn-neutral px-3 py-2 text-sm"
                                data-testid="resend-invitation-btn"
                              >
                                {resendingId === invitation.id ? 'Sending...' : 'Resend email'}
                              </button>
                            )}
                          </div>
                        )}
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            type="text"
                            value={invitationUrl}
                            readOnly
                            aria-label={`Invitation link for ${invitation.email || invitation.organization.name}`}
                            className="flex-1 p-2 text-sm rounded font-mono border border-[var(--border)] bg-[var(--surface-secondary)] text-primary"
                          />
                          <button
                            onClick={() => copyToClipboard(invitationUrl, invitation.id)}
                            className="btn-neutral px-3 py-2 text-sm"
                            data-testid="copy-link-btn"
                          >
                            {copiedInvitationId === invitation.id ? 'Copied' : 'Copy link'}
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
