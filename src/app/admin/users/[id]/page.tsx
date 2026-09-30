'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Header from '@/components/navigation/Header'

interface SupportData {
  user: {
    id: string
    name: string | null
    email: string
    role: string
    createdAt: string
    updatedAt: string
    emailVerified: string | null
    invitationAcceptedAt: string | null
    organization: { id: string; name: string } | null
    invitedBy: { id: string; name: string | null; email: string } | null
    usedInvitation: {
      id: string
      createdAt: string
      usedAt: string | null
      expiresAt: string
      emailAcceptedAt: string | null
      emailProviderId: string | null
      emailLastError: string | null
    } | null
    passwordResetTokens: Array<{
      id: string
      createdAt: string
      expiresAt: string
      usedAt: string | null
    }>
  }
  auditEvents: Array<{
    id: string
    timestamp: string
    eventType: string
    channel: string
    metadata: unknown
    actor: { id: string; name: string | null; email: string } | null
  }>
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not recorded'
}

export default function UserSupportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<SupportData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user || session.user.role !== 'SYSTEM_ADMIN') {
      router.push('/')
      return
    }

    fetch(`/api/users/${params.id}`)
      .then(async response => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Failed to load user')
        setData(result)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load user'))
  }, [params.id, router, session, status])

  if (!data && !error) {
    return <div className="page-shell"><Header /><div className="p-8 text-center text-muted">Loading user...</div></div>
  }

  if (error || !data) {
    return <div className="page-shell"><Header /><div className="max-w-4xl mx-auto p-8"><div className="alert-error">{error}</div></div></div>
  }

  const { user, auditEvents } = data

  return (
    <div className="page-shell" data-testid="admin-user-detail-page">
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="page-title">{user.name || 'Unnamed user'}</h1>
            <p className="text-secondary mt-1">{user.email}</p>
          </div>
          <Link href="/admin/users" className="btn-neutral px-4 py-2 text-sm">Back to Users</Link>
        </div>

        <section className="card p-6">
          <h2 className="text-lg font-semibold text-primary mb-4">Account Status</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><dt className="text-muted">Organization</dt><dd className="text-primary">{user.organization?.name || 'None'}</dd></div>
            <div><dt className="text-muted">Role</dt><dd className="text-primary">{user.role}</dd></div>
            <div><dt className="text-muted">Account created</dt><dd className="text-primary">{formatDate(user.createdAt)}</dd></div>
            <div><dt className="text-muted">Email verified</dt><dd className="text-primary">{formatDate(user.emailVerified)}</dd></div>
            <div><dt className="text-muted">Invitation accepted</dt><dd className="text-primary">{formatDate(user.invitationAcceptedAt)}</dd></div>
            <div><dt className="text-muted">Invited by</dt><dd className="text-primary">{user.invitedBy?.name || user.invitedBy?.email || 'Not recorded'}</dd></div>
          </dl>
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-semibold text-primary mb-4">Invitation and Email</h2>
          {user.usedInvitation ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><dt className="text-muted">Invitation created</dt><dd className="text-primary">{formatDate(user.usedInvitation.createdAt)}</dd></div>
              <div><dt className="text-muted">Invitation used</dt><dd className="text-primary">{formatDate(user.usedInvitation.usedAt)}</dd></div>
              <div><dt className="text-muted">Accepted by Resend</dt><dd className="text-primary">{formatDate(user.usedInvitation.emailAcceptedAt)}</dd></div>
              <div><dt className="text-muted">Latest email error</dt><dd className="text-primary">{user.usedInvitation.emailLastError || 'None recorded'}</dd></div>
            </dl>
          ) : <p className="text-muted text-sm">No consumed invitation is linked to this account.</p>}
        </section>

        <section className="card overflow-hidden">
          <div className="card-header"><h2 className="text-lg font-semibold text-primary">Password Reset Requests</h2></div>
          {user.passwordResetTokens.length === 0 ? <p className="p-6 text-muted text-sm">No password reset request matched this account.</p> : (
            <div className="overflow-x-auto"><table className="data-table"><thead><tr><th className="px-6 py-3">Requested</th><th className="px-6 py-3">Expires</th><th className="px-6 py-3">Status</th></tr></thead><tbody>
              {user.passwordResetTokens.map(token => <tr key={token.id}><td className="px-6 py-4 text-sm">{formatDate(token.createdAt)}</td><td className="px-6 py-4 text-sm">{formatDate(token.expiresAt)}</td><td className="px-6 py-4 text-sm">{token.usedAt ? `Used ${formatDate(token.usedAt)}` : new Date(token.expiresAt) < new Date() ? 'Expired' : 'Active'}</td></tr>)}
            </tbody></table></div>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="card-header"><h2 className="text-lg font-semibold text-primary">Recent Activity</h2></div>
          {auditEvents.length === 0 ? <p className="p-6 text-muted text-sm">No audit events are associated with this user.</p> : (
            <div className="divide-y divide-[var(--border)]">
              {auditEvents.map(event => <div key={event.id} className="p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium text-primary">{event.eventType.replaceAll('_', ' ')}</span><span className="text-muted">{formatDate(event.timestamp)}</span></div><div className="text-muted mt-1">{event.channel}{event.actor ? ` by ${event.actor.name || event.actor.email}` : ''}</div></div>)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
