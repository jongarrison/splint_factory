import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"
import { logAuditEvent } from "@/lib/audit"
import { validatePassword } from "@/lib/password"
import { sendEmail } from "@/lib/email"
import EmailVerificationEmail from "@/emails/email-verification"
import {
  REGISTRATION_ACKNOWLEDGMENT_TEXT,
  REGISTRATION_ACKNOWLEDGMENT_VERSION,
} from "@/lib/registration-acknowledgment"

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, invitationToken, responsibilityAcknowledged } = await request.json()

    // Validate input that does not come from the invitation.
    if (!name || !password) {
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

    if (responsibilityAcknowledged !== true) {
      return NextResponse.json(
        { error: "You must acknowledge responsibility before creating an account" },
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

    const registrationEmail = invitationData.email || email

    if (!registrationEmail) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: registrationEmail }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // If invitation had a specific email, the user proved inbox access by clicking
    // the emailed link, so pre-verify their email. Otherwise send verification email.
    const emailPreVerified = Boolean(invitationData.email);

    // Create user with organization association from invitation
    // Future registration handlers must persist this acknowledgment snapshot too.
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name,
          email: registrationEmail,
          password: hashedPassword,
          organizationId: invitationData.organizationId,
          role: UserRole.MEMBER,
          invitedByUserId: invitationData.createdByUserId,
          invitationAcceptedAt: new Date(),
          ...(emailPreVerified ? { emailVerified: new Date() } : {}),
        },
      })

      await tx.userRegistrationAcknowledgment.create({
        data: {
          userId: createdUser.id,
          acknowledgmentVersion: REGISTRATION_ACKNOWLEDGMENT_VERSION,
          acknowledgmentText: REGISTRATION_ACKNOWLEDGMENT_TEXT,
        },
      })

      await tx.invitationLink.update({
        where: { id: invitationData.id },
        data: {
          usedAt: new Date(),
          usedByUserId: createdUser.id
        }
      })

      return createdUser
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
        acknowledgmentVersion: REGISTRATION_ACKNOWLEDGMENT_VERSION,
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
