import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { logAuditEvent } from "@/lib/audit"
import { validatePassword } from "@/lib/password"
import { sendEmail } from "@/lib/email"
import EmailVerificationEmail from "@/emails/email-verification"

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, invitationToken } = await request.json()

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Validate password strength
    const passwordCheck = validatePassword(password)
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.errors.join('. ') },
        { status: 400 }
      )
    }

    // Require invitation token
    if (!invitationToken) {
      return NextResponse.json(
        { error: "An invitation is required to create an account" },
        { status: 403 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      )
    }

    // Validate invitation token
    const invitationData = await prisma.invitationLink.findUnique({
      where: { 
        token: invitationToken,
        usedAt: null, // Not used yet
        expiresAt: { gt: new Date() } // Not expired
      },
      include: { organization: true }
    })

    if (!invitationData) {
      return NextResponse.json(
        { error: "Invalid or expired invitation" },
        { status: 400 }
      )
    }

    // If invitation has a specific email, validate it matches
    if (invitationData.email && invitationData.email !== email) {
      return NextResponse.json(
        { error: "Invitation is for a different email address" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // If invitation had a specific email, the user proved inbox access by clicking
    // the emailed link, so pre-verify their email. Otherwise send verification email.
    const emailPreVerified = invitationData.email && invitationData.email === email;

    // Create user with organization association from invitation
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        organizationId: invitationData.organizationId,
        role: UserRole.MEMBER,
        invitedByUserId: invitationData.createdByUserId,
        invitationAcceptedAt: new Date(),
        ...(emailPreVerified ? { emailVerified: new Date() } : {}),
      },
    })

    // Mark invitation as used
    await prisma.invitationLink.update({
      where: { id: invitationData.id },
      data: {
        usedAt: new Date(),
        usedByUserId: user.id
      }
    })

    // Remove password from response
    const { password: _password, ...userWithoutPassword } = user
    
    // Suppress unused variable warning - _password is intentionally unused
    void _password

    // Log the registration event (fire-and-forget)
    logAuditEvent({
      eventType: 'USER_REGISTERED',
      channel: 'AUTH',
      actorId: invitationData.createdByUserId,
      targetUserId: user.id,
      organizationId: invitationData.organizationId,
      metadata: {
        invitationToken: invitationData.token,
        userEmail: user.email,
        userName: user.name,
      },
    });

    // Only send verification email if not pre-verified via invitation email
    if (!emailPreVerified) {
      try {
        const verificationToken = await prisma.emailVerificationToken.create({
          data: {
            userId: user.id,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
        const baseUrl = process.env.NEXTAUTH_URL || `https://${request.headers.get('host')}`;
        const verifyUrl = `${baseUrl}/verify-email?token=${verificationToken.token}`;
        sendEmail({
          to: user.email,
          subject: 'Verify your Splint Factory email',
          react: EmailVerificationEmail({ verifyUrl }),
        });
      } catch (emailErr) {
        console.error('Failed to send verification email:', emailErr);
      }
    }

    return NextResponse.json(
      { message: "User created successfully", user: userWithoutPassword },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
