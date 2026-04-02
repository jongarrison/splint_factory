import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { logAuditEvent } from '@/lib/audit';
import PasswordResetEmail from '@/emails/password-reset';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Always return success to avoid email enumeration
    const successResponse = NextResponse.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return successResponse;
    }

    // Invalidate any existing unused tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Create reset token (expires in 1 hour)
    const resetToken = await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    // Build reset URL
    const baseUrl = process.env.NEXTAUTH_URL || `https://${request.headers.get('host')}`;
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken.token}`;

    await sendEmail({
      to: email,
      subject: 'Reset your Splint Factory password',
      react: PasswordResetEmail({ resetUrl }),
    });

    logAuditEvent({
      eventType: 'PASSWORD_RESET_REQUESTED',
      channel: 'AUTH',
      targetUserId: user.id,
      metadata: { email },
    });

    return successResponse;
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
