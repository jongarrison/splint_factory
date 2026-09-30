import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendInvitationEmail } from '@/lib/send-invitation-email'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, organizationId: true, name: true, email: true },
    })

    if (!user || user.role === 'MEMBER') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const invitation = await prisma.invitationLink.findUnique({
      where: { id },
      include: {
        organization: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
      },
    })

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    if (user.role === 'ORG_ADMIN' && user.organizationId !== invitation.organizationId) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    if (!invitation.email) {
      return NextResponse.json({ error: 'Invitation has no email address' }, { status: 400 })
    }

    if (invitation.usedAt || invitation.expiresAt <= new Date()) {
      return NextResponse.json({ error: 'Invitation is used or expired' }, { status: 400 })
    }

    const baseUrl = process.env.NEXTAUTH_URL || `https://${request.headers.get('host')}`
    const updatedInvitation = await sendInvitationEmail({
      invitationId: invitation.id,
      email: invitation.email,
      token: invitation.token,
      organizationName: invitation.organization.name,
      invitedByName: invitation.createdBy.name || invitation.createdBy.email,
      baseUrl,
    })

    if (updatedInvitation.emailLastError) {
      return NextResponse.json(
        { error: updatedInvitation.emailLastError, invitation: updatedInvitation },
        { status: 502 }
      )
    }

    return NextResponse.json(updatedInvitation)
  } catch (error) {
    console.error('Failed to resend invitation email:', error)
    return NextResponse.json({ error: 'Failed to resend invitation email' }, { status: 500 })
  }
}
