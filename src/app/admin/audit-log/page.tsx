'use client'

import { Fragment, useEffect, useState } from 'react'
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
  designJobId: string | null
  clientDeviceId: string | null
  printerSerial: string | null
  printJobId: string | null
  organization: { id: string; name: string | null } | null
  designJob: { id: string; objectId: string | null } | null
  clientDevice: { id: string; name: string | null } | null
  printer: { serial: string; name: string | null; model: string | null } | null
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())

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

  const toggleExpanded = (id: string) => {
    setExpandedIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
                {data?.events.map(event => {
                  const expanded = expandedIds.has(event.id)
                  return (
                    <Fragment key={event.id}>
                      <tr>
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
                          <button
                            type="button"
                            onClick={() => toggleExpanded(event.id)}
                            className="text-link hover:underline"
                            aria-expanded={expanded}
                          >
                            {expanded ? 'Hide' : 'View'}
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={6} className="border-t border-[var(--border)] bg-[var(--surface-secondary)] px-6 py-5">
                            <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                              <div>
                                <div className="text-xs font-medium uppercase text-muted">Object</div>
                                {event.designJob ? (
                                  <Link href={`/design-jobs/${event.designJob.id}`} className="text-link hover:underline">
                                    {event.designJob.objectId || 'Object ID unavailable'}
                                  </Link>
                                ) : <div className="text-secondary">None</div>}
                                {event.designJobId && <div className="break-all font-mono text-xs text-muted">{event.designJobId}</div>}
                              </div>
                              <div>
                                <div className="text-xs font-medium uppercase text-muted">Organization</div>
                                {event.organization ? (
                                  <>
                                    <Link href={`/admin/organizations/${event.organization.id}`} className="text-link hover:underline">
                                      {event.organization.name || 'Unknown organization'}
                                    </Link>
                                    <div className="break-all font-mono text-xs text-muted">{event.organization.id}</div>
                                  </>
                                ) : <div className="text-secondary">None</div>}
                              </div>
                              <div>
                                <div className="text-xs font-medium uppercase text-muted">Splintbot</div>
                                {event.clientDevice ? (
                                  <>
                                    <div className="text-primary">{event.clientDevice.name || 'Unknown Splintbot'}</div>
                                    <div className="break-all font-mono text-xs text-muted">{event.clientDevice.id}</div>
                                  </>
                                ) : <div className="text-secondary">None</div>}
                              </div>
                              <div>
                                <div className="text-xs font-medium uppercase text-muted">Printer</div>
                                {event.printer ? (
                                  <>
                                    <div className="text-primary">
                                      {event.printer.name || event.printer.model || 'Unknown printer'}
                                      {event.printer.name && event.printer.model ? ` (${event.printer.model})` : ''}
                                    </div>
                                    <div className="break-all font-mono text-xs text-muted">{event.printer.serial}</div>
                                  </>
                                ) : <div className="text-secondary">None</div>}
                              </div>
                              <div>
                                <div className="text-xs font-medium uppercase text-muted">Print Job</div>
                                {event.printJobId ? (
                                  <Link href={`/print-queue/${event.printJobId}`} className="break-all font-mono text-xs text-link hover:underline">
                                    {event.printJobId}
                                  </Link>
                                ) : <div className="text-secondary">None</div>}
                              </div>
                              <div>
                                <div className="text-xs font-medium uppercase text-muted">Audit Event</div>
                                <div className="break-all font-mono text-xs text-secondary">{event.id}</div>
                              </div>
                            </div>
                            <div className="mt-5">
                              <div className="mb-2 text-xs font-medium uppercase text-muted">Event Data</div>
                              {event.metadata ? (
                                <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-xs text-secondary">
                                  {JSON.stringify(event.metadata, null, 2)}
                                </pre>
                              ) : <div className="text-sm text-secondary">No event-specific data.</div>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
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