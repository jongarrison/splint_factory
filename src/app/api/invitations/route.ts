import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { sendInvitationEmail } from '@/lib/send-invitation-email'

// GET /api/invitations - List invitations for current user's organization
export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user with organization
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { organization: true }
    })

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'User not assigned to organization' }, { status: 400 })
    }

    // Get invitations for user's organization
    const invitations = await prisma.invitationLink.findMany({
      where: { organizationId: user.organizationId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        usedBy: { select: { id: true, name: true, email: true } },
        organization: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(invitations)
  } catch (error) {
    console.error('Failed to fetch invitations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    )
  }
}

// POST /api/invitations - Create new invitation link
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { organizationId, expiresInDays = 7, email, emails } = body
    const isBatchRequest = emails !== undefined

    if (isBatchRequest && !Array.isArray(emails)) {
      return NextResponse.json({ error: 'Emails must be an array' }, { status: 400 })
    }

    if (isBatchRequest && emails.some((address: unknown) => typeof address !== 'string')) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const emailAddresses: Array<string | null> = isBatchRequest
      ? Array.from(new Map<string, string>(
          emails
            .map((address: string) => address.trim())
            .filter(Boolean)
            .map((address: string) => [address.toLowerCase(), address])
        ).values())
      : [typeof email === 'string' && email.trim() ? email.trim() : null]

    if (isBatchRequest && emailAddresses.length === 0) {
      return NextResponse.json({ error: 'At least one email address is required' }, { status: 400 })
    }

    const invalidEmail = emailAddresses.find(
      address => address && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)
    )
    if (invalidEmail) {
      return NextResponse.json({ error: `Invalid email address: ${invalidEmail}` }, { status: 400 })
    }

    // Get user with organization and role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { organization: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check permissions: only SYSTEM_ADMIN and ORG_ADMIN can create invitations
    if (user.role === 'MEMBER') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // ORG_ADMIN can only create invitations for their own organization
    if (user.role === 'ORG_ADMIN' && user.organizationId !== organizationId) {
      return NextResponse.json({ 
        error: 'Cannot create invitations for other organizations' 
      }, { status: 403 })
    }

    // Validate organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Calculate expiration date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)

    const baseUrl = process.env.NEXTAUTH_URL || `https://${request.headers.get('host')}`
    const invitations = []

    for (const emailAddress of emailAddresses) {
      const token = randomBytes(32).toString('hex')
      const invitation = await prisma.invitationLink.create({
        data: {
          token,
          email: emailAddress,
          expiresAt,
          organizationId,
          createdByUserId: user.id,
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          organization: { select: { id: true, name: true } }
        }
      })

      if (emailAddress) {
        const emailResult = await sendInvitationEmail({
          invitationId: invitation.id,
          email: emailAddress,
          token,
          organizationName: organization.name,
          invitedByName: user.name || user.email,
          baseUrl,
          actorId: user.id,
          organizationId,
          action: 'create',
        })

        invitation.emailAcceptedAt = emailResult.emailAcceptedAt
        invitation.emailProviderId = emailResult.emailProviderId
        invitation.emailLastError = emailResult.emailLastError
      }

      invitations.push(invitation)
    }

    return NextResponse.json(
      isBatchRequest ? { invitations } : invitations[0],
      { status: 201 }
    )
  } catch (error) {
    console.error('Failed to create invitation:', error)
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    )
  }
}
