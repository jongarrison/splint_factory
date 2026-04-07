import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { sendEmail } from '@/lib/email'
import InvitationEmail from '@/emails/invitation-email'

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
    const { organizationId, expiresInDays = 7, email } = body

    // Basic email format validation if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
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

    // Generate unique token
    const token = randomBytes(32).toString('hex')

    // Create invitation link
    const invitation = await prisma.invitationLink.create({
      data: {
        token,
        email: email || null,
        expiresAt,
        organizationId,
        createdByUserId: user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        organization: { select: { id: true, name: true } }
      }
    })

    // Send invitation email if email was provided
    if (email) {
      const baseUrl = process.env.NEXTAUTH_URL || `https://${request.headers.get('host')}`;
      const registerUrl = `${baseUrl}/register?invitation=${token}`;
      sendEmail({
        to: email,
        subject: `You're invited to join ${organization.name} on Splint Factory`,
        react: InvitationEmail({
          registerUrl,
          organizationName: organization.name,
          invitedByName: user.name || user.email,
        }),
      });
    }

    return NextResponse.json(invitation, { status: 201 })
  } catch (error) {
    console.error('Failed to create invitation:', error)
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    )
  }
}
