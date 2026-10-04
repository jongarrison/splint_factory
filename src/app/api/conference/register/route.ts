import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { verifyTurnstile } from '@/lib/turnstile'
import { logAuditEvent } from '@/lib/audit'
import EmailVerificationEmail from '@/emails/email-verification'
import ConferenceAccessAlert from '@/emails/conference-access-alert'
import {
  REGISTRATION_ACKNOWLEDGMENT_TEXT,
  REGISTRATION_ACKNOWLEDGMENT_VERSION,
} from '@/lib/registration-acknowledgment'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DAY_MS = 24 * 60 * 60 * 1000
const LOGIN_TOKEN_LIFETIME_MS = 5 * 60 * 1000

type SubmissionOutcome = 'access-request' | 'account-created' | 'existing-account'

async function notifyAdmins(data: {
  name: string
  email: string
  phone?: string
  organizationName?: string
  outcome: SubmissionOutcome
  submittedAt: Date
}) {
  const recipients = await prisma.user.findMany({
    where: { role: UserRole.SYSTEM_ADMIN, siteAlertOptIn: true },
    select: { email: true },
  })
  if (recipients.length === 0) return

  try {
    await sendEmail({
      to: recipients.map((recipient) => recipient.email),
      subject: `Conference access: ${data.name} - ${data.outcome}`,
      react: ConferenceAccessAlert({
        ...data,
        submittedAt: data.submittedAt.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }),
      }),
    })
  } catch (error) {
    console.error('[Conference] Admin alert delivery failed:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      name?: string
      email?: string
      phone?: string
      responsibilityAcknowledged?: boolean
      turnstileToken?: string
    }
    const name = body.name?.trim()
    const email = body.email?.trim().toLowerCase()
    const phone = body.phone?.trim() || undefined

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
    }
    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')
    if (!await verifyTurnstile(body.turnstileToken, ip)) {
      return NextResponse.json({ error: 'Captcha verification failed' }, { status: 400 })
    }

    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'system_settings' },
      select: {
        conferenceRegistrationEnabled: true,
        conferenceOrganizationId: true,
        conferenceOrganization: { select: { name: true, isActive: true } },
      },
    })
    const organization = settings?.conferenceOrganization
    const registrationEnabled = Boolean(
      settings?.conferenceRegistrationEnabled && settings.conferenceOrganizationId && organization?.isActive
    )

    if (!registrationEnabled || !settings?.conferenceOrganizationId || !organization) {
      const submission = await prisma.conferenceAccessRequest.create({
        data: { name, email, phone, registrationEnabled: false },
      })
      logAuditEvent({
        eventType: 'CONFERENCE_ACCESS_REQUEST_SUBMITTED',
        channel: 'REGISTRATION',
        metadata: {
          submissionId: submission.id,
          email,
          name,
          registrationEnabled: false,
        },
      })
      await notifyAdmins({ name, email, phone, outcome: 'access-request', submittedAt: submission.createdAt })
      return NextResponse.json({ outcome: 'access-request' }, { status: 201 })
    }

    if (body.responsibilityAcknowledged !== true) {
      return NextResponse.json({ error: 'You must acknowledge responsibility before creating an account' }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existingUser) {
      const submission = await prisma.conferenceAccessRequest.create({
        data: {
          name,
          email,
          phone,
          registrationEnabled: true,
          organizationId: settings.conferenceOrganizationId,
          userId: existingUser.id,
        },
      })
      logAuditEvent({
        eventType: 'CONFERENCE_EXISTING_ACCOUNT_SUBMITTED',
        channel: 'REGISTRATION',
        targetUserId: existingUser.id,
        organizationId: settings.conferenceOrganizationId,
        metadata: {
          submissionId: submission.id,
          email,
          name,
        },
      })
      await notifyAdmins({
        name,
        email,
        phone,
        organizationName: organization.name,
        outcome: 'existing-account',
        submittedAt: submission.createdAt,
      })
      return NextResponse.json({ code: 'ACCOUNT_EXISTS' }, { status: 409 })
    }

    const now = new Date()
    const graceExpiresAt = new Date(now.getTime() + DAY_MS)
    const initialLoginToken = randomBytes(32).toString('hex')
    const generatedPassword = randomBytes(32).toString('hex')
    const password = await bcrypt.hash(generatedPassword, 12)

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password,
          role: UserRole.MEMBER,
          organizationId: settings.conferenceOrganizationId,
          emailVerificationGraceExpiresAt: graceExpiresAt,
        },
      })
      await tx.userRegistrationAcknowledgment.create({
        data: {
          userId: user.id,
          acknowledgmentVersion: REGISTRATION_ACKNOWLEDGMENT_VERSION,
          acknowledgmentText: REGISTRATION_ACKNOWLEDGMENT_TEXT,
        },
      })
      const verificationToken = await tx.emailVerificationToken.create({
        data: { userId: user.id, expiresAt: graceExpiresAt },
      })
      await tx.conferenceLoginToken.create({
        data: {
          userId: user.id,
          token: initialLoginToken,
          expiresAt: new Date(now.getTime() + LOGIN_TOKEN_LIFETIME_MS),
        },
      })
      const submission = await tx.conferenceAccessRequest.create({
        data: {
          name,
          email,
          phone,
          registrationEnabled: true,
          organizationId: settings.conferenceOrganizationId,
          userId: user.id,
        },
      })
      return { user, verificationToken, submission }
    })

    const verifyUrl = `${process.env.NEXTAUTH_URL || request.nextUrl.origin}/verify-email?token=${result.verificationToken.token}`
    const emailResults = await Promise.allSettled([
      sendEmail({
        to: email,
        subject: 'Verify your Splint Factory email',
        react: EmailVerificationEmail({ verifyUrl }),
        auditContext: { targetUserId: result.user.id, organizationId: settings.conferenceOrganizationId },
      }),
      notifyAdmins({
        name,
        email,
        phone,
        organizationName: organization.name,
        outcome: 'account-created',
        submittedAt: result.submission.createdAt,
      }),
    ])
    emailResults.forEach((emailResult) => {
      if (emailResult.status === 'rejected') console.error('[Conference] Email delivery failed:', emailResult.reason)
    })

    logAuditEvent({
      eventType: 'USER_REGISTERED',
      channel: 'AUTH',
      targetUserId: result.user.id,
      organizationId: settings.conferenceOrganizationId,
      metadata: {
        source: 'conference',
        submissionId: result.submission.id,
        acknowledgmentVersion: REGISTRATION_ACKNOWLEDGMENT_VERSION,
        emailVerificationGraceExpiresAt: graceExpiresAt.toISOString(),
      },
    })

    return NextResponse.json({ outcome: 'account-created', loginToken: initialLoginToken }, { status: 201 })
  } catch (error) {
    console.error('[Conference] Registration failed:', error)
    return NextResponse.json({ error: 'Unable to submit conference access request' }, { status: 500 })
  }
}