import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 }
      );
    }

    if (verificationToken.usedAt) {
      return NextResponse.json(
        { error: 'This token has already been used' },
        { status: 400 }
      );
    }

    if (verificationToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'This token has expired. Please request a new verification email.' },
        { status: 400 }
      );
    }

    // Mark token as used and set emailVerified on user in a transaction
    await prisma.$transaction([
      prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerified: new Date() },
      }),
    ]);

    logAuditEvent({
      eventType: 'EMAIL_VERIFIED',
      channel: 'AUTH',
      actorId: verificationToken.userId,
      targetUserId: verificationToken.userId,
      organizationId: verificationToken.user.organizationId ?? undefined,
      metadata: { email: verificationToken.user.email },
    });

    return NextResponse.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify email error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
