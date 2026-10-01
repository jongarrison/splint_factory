import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const PAGE_SIZE = 100

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase()

  return normalized.includes('password')
    || normalized.endsWith('token')
    || normalized.endsWith('secret')
    || normalized === 'apikey'
    || normalized === 'apikeyhash'
    || normalized === 'keyhash'
    || normalized === 'authorization'
    || normalized === 'cookie'
    || normalized === 'setcookie'
}

function sanitizeMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeMetadata)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        isSensitiveKey(key) ? '[redacted]' : sanitizeMetadata(nestedValue),
      ])
    )
  }

  return value
}

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })

  if (currentUser?.role !== 'SYSTEM_ADMIN') {
    return NextResponse.json({ error: 'System admin access required' }, { status: 403 })
  }

  const requestedPage = Number(request.nextUrl.searchParams.get('page') || '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const channel = request.nextUrl.searchParams.get('channel') || undefined
  const eventType = request.nextUrl.searchParams.get('eventType') || undefined
  const where = { channel, eventType }

  const [events, total, channelCounts, eventTypeCounts] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        timestamp: true,
        eventType: true,
        channel: true,
        metadata: true,
        actor: { select: { id: true, name: true, email: true } },
        targetUser: { select: { id: true, name: true, email: true } },
        organizationId: true,
      },
    }),
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.groupBy({
      by: ['channel'],
      _count: { _all: true },
      orderBy: { channel: 'asc' },
    }),
    prisma.auditEvent.groupBy({
      by: ['eventType'],
      _count: { _all: true },
      orderBy: { eventType: 'asc' },
    }),
  ])

  return NextResponse.json({
    events: events.map(event => ({
      ...event,
      metadata: sanitizeMetadata(event.metadata),
    })),
    page,
    pageSize: PAGE_SIZE,
    total,
    channelCounts: channelCounts.map(item => ({ channel: item.channel, count: item._count._all })),
    eventTypeCounts: eventTypeCounts.map(item => ({ eventType: item.eventType, count: item._count._all })),
  })
}