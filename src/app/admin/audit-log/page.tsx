'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Header from '@/components/navigation/Header'

interface AuditPerson {
  id: string
  name: string | null
  email: string
}

interface AuditEvent {
  id: string
  timestamp: string
  eventType: string
  channel: string
  metadata: unknown
  actor: AuditPerson | null
  targetUser: AuditPerson | null
  organizationId: string | null
}

interface AuditResponse {
  events: AuditEvent[]
  page: number
  pageSize: number
  total: number
  channelCounts: Array<{ channel: string; count: number }>
  eventTypeCounts: Array<{ eventType: string; count: number }>
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function personLabel(person: AuditPerson) {
  return person.name || person.email
}

export default function AuditLogPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<AuditResponse | null>(null)
  const [channel, setChannel] = useState('')
  const [eventType, setEventType] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filtersReady, setFiltersReady] = useState(false)

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    setChannel(query.get('channel') || '')
    setEventType(query.get('eventType') || '')
    setFiltersReady(true)
  }, [])

  useEffect(() => {
    if (!filtersReady || status === 'loading') return
    if (!session?.user || session.user.role !== 'SYSTEM_ADMIN') {
      router.push('/')
      return
    }

    const controller = new AbortController()
    const query = new URLSearchParams({ page: String(page) })
    if (channel) query.set('channel', channel)
    if (eventType) query.set('eventType', eventType)

    setLoading(true)
    setError('')
    fetch(`/api/admin/audit-events?${query}`, { signal: controller.signal })
      .then(async response => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Failed to load audit events')
        setData(result)
      })
      .catch(err => {
        if (err instanceof Error && err.name !== 'AbortError') setError(err.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [channel, eventType, filtersReady, page, router, session, status])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="page-shell" data-testid="admin-audit-log-page">
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="text-secondary mt-2">System, authentication, and email activity</p>
        </div>

        <div className="card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="audit-channel" className="block text-sm font-medium text-secondary mb-2">Channel</label>
              <select
                id="audit-channel"
                value={channel}
                onChange={event => { setChannel(event.target.value); setPage(1) }}
                className="input-field text-sm"
              >
                <option value="">All channels</option>
                {data?.channelCounts.map(item => (
                  <option key={item.channel} value={item.channel}>{item.channel} ({item.count})</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="audit-event-type" className="block text-sm font-medium text-secondary mb-2">Event Type</label>
              <select
                id="audit-event-type"
                value={eventType}
                onChange={event => { setEventType(event.target.value); setPage(1) }}
                className="input-field text-sm"
              >
                <option value="">All event types</option>
                {data?.eventTypeCounts.map(item => (
                  <option key={item.eventType} value={item.eventType}>
                    {item.eventType.replaceAll('_', ' ')} ({item.count})
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm text-muted">
              {data ? `${data.total.toLocaleString()} matching events` : 'Loading events'}
            </div>
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {!loading && data?.events.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No matching audit events.</td></tr>
                )}
                {data?.events.map(event => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-muted">{formatDate(event.timestamp)}</td>
                    <td className="px-4 py-3 text-sm">{event.channel}</td>
                    <td className="px-4 py-3 text-sm font-medium text-primary whitespace-nowrap">
                      {event.eventType.replaceAll('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {event.actor ? <Link href={`/admin/users/${event.actor.id}`} className="text-link hover:underline">{personLabel(event.actor)}</Link> : <span className="text-muted">System</span>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {event.targetUser ? <Link href={`/admin/users/${event.targetUser.id}`} className="text-link hover:underline">{personLabel(event.targetUser)}</Link> : <span className="text-muted">None</span>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {event.metadata ? (
                        <details>
                          <summary className="text-link cursor-pointer">View</summary>
                          <pre className="mt-2 max-w-md whitespace-pre-wrap break-words text-xs text-secondary">{JSON.stringify(event.metadata, null, 2)}</pre>
                        </details>
                      ) : <span className="text-muted">None</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setPage(current => Math.max(1, current - 1))}
              disabled={page <= 1 || loading}
              className="btn-neutral px-3 py-2 text-sm"
            >
              Previous
            </button>
            <span className="text-sm text-muted">Page {page} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage(current => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages || loading}
              className="btn-neutral px-3 py-2 text-sm"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}