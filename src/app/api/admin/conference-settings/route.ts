import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'

async function requireSystemAdmin() {
  const session = await auth()
  return session?.user?.role === 'SYSTEM_ADMIN' ? session : null
}

export async function GET() {
  const session = await requireSystemAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [settings, organizations] = await Promise.all([
    prisma.systemSettings.findUnique({
      where: { id: 'system_settings' },
      select: { conferenceRegistrationEnabled: true, conferenceOrganizationId: true },
    }),
    prisma.organization.findMany({
      select: { id: true, name: true, isActive: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return NextResponse.json({
    conferenceRegistrationEnabled: settings?.conferenceRegistrationEnabled ?? false,
    conferenceOrganizationId: settings?.conferenceOrganizationId ?? null,
    organizations,
  })
}

export async function PUT(request: NextRequest) {
  const session = await requireSystemAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    conferenceRegistrationEnabled?: boolean
    conferenceOrganizationId?: string | null
  }
  const enabled = body.conferenceRegistrationEnabled === true
  const organizationId = body.conferenceOrganizationId || null

  if (enabled && !organizationId) {
    return NextResponse.json({ error: 'Select an organization before enabling registration' }, { status: 400 })
  }
  if (organizationId) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { isActive: true },
    })
    if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    if (enabled && !organization.isActive) {
      return NextResponse.json({ error: 'Conference registration requires an active organization' }, { status: 400 })
    }
  }

  const previous = await prisma.systemSettings.findUnique({
    where: { id: 'system_settings' },
    select: { conferenceRegistrationEnabled: true, conferenceOrganizationId: true },
  })
  const updated = await prisma.systemSettings.upsert({
    where: { id: 'system_settings' },
    update: {
      conferenceRegistrationEnabled: enabled,
      conferenceOrganizationId: organizationId,
    },
    create: {
      id: 'system_settings',
      conferenceRegistrationEnabled: enabled,
      conferenceOrganizationId: organizationId,
    },
    select: { conferenceRegistrationEnabled: true, conferenceOrganizationId: true },
  })

  if (
    (previous?.conferenceRegistrationEnabled ?? false) !== updated.conferenceRegistrationEnabled
    || (previous?.conferenceOrganizationId ?? null) !== updated.conferenceOrganizationId
  ) {
    logAuditEvent({
      eventType: 'CONFERENCE_REGISTRATION_SETTINGS_CHANGED',
      channel: 'SYSTEM',
      actorId: session.user.id,
      organizationId: updated.conferenceOrganizationId,
      metadata: {
        previousEnabled: previous?.conferenceRegistrationEnabled ?? false,
        newEnabled: updated.conferenceRegistrationEnabled,
        previousOrganizationId: previous?.conferenceOrganizationId ?? null,
        newOrganizationId: updated.conferenceOrganizationId,
      },
    })
  }

  return NextResponse.json(updated)
}