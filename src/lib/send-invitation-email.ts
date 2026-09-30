import InvitationEmail from '@/emails/invitation-email'
import { sendEmail } from '@/lib/email'
import { prisma } from '@/lib/prisma'

interface SendInvitationEmailParams {
  invitationId: string
  email: string
  token: string
  organizationName: string
  invitedByName: string
  baseUrl: string
}

export async function sendInvitationEmail({
  invitationId,
  email,
  token,
  organizationName,
  invitedByName,
  baseUrl,
}: SendInvitationEmailParams) {
  try {
    const result = await sendEmail({
      to: email,
      subject: `You're invited to join ${organizationName} on Splint Factory`,
      react: InvitationEmail({
        registerUrl: `${baseUrl}/register?invitation=${token}`,
        organizationName,
        invitedByName,
      }),
    })

    if (!result) {
      throw new Error('Email service is not configured')
    }

    return prisma.invitationLink.update({
      where: { id: invitationId },
      data: {
        emailAcceptedAt: new Date(),
        emailProviderId: result.id,
        emailLastError: null,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown email error'

    return prisma.invitationLink.update({
      where: { id: invitationId },
      data: {
        emailAcceptedAt: null,
        emailProviderId: null,
        emailLastError: message.slice(0, 500),
      },
    })
  }
}