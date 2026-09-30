import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      emailVerified: true,
      invitationAcceptedAt: true,
      organization: { select: { id: true, name: true } },
      invitedBy: { select: { id: true, name: true, email: true } },
      usedInvitation: {
        select: {
          id: true,
          createdAt: true,
          usedAt: true,
          expiresAt: true,
          emailAcceptedAt: true,
          emailProviderId: true,
          emailLastError: true,
        },
      },
      passwordResetTokens: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, createdAt: true, expiresAt: true, usedAt: true },
      },
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const auditEvents = await prisma.auditEvent.findMany({
    where: { OR: [{ actorId: id }, { targetUserId: id }] },
    orderBy: { timestamp: 'desc' },
    take: 50,
    select: {
      id: true,
      timestamp: true,
      eventType: true,
      channel: true,
      metadata: true,
      actor: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json({ user, auditEvents })
}
