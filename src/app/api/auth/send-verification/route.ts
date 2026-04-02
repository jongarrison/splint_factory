import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { auth } from '@/lib/auth';
import EmailVerificationEmail from '@/emails/email-verification';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: 'Email already verified' }, { status: 400 });
    }

    // Rate limit: don't send if a token was created in the last 60 seconds
    const recentToken = await prisma.emailVerificationToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        createdAt: { gt: new Date(Date.now() - 60 * 1000) },
      },
    });

    if (recentToken) {
      return NextResponse.json(
        { error: 'Please wait before requesting another verification email' },
        { status: 429 }
      );
    }

    // Invalidate existing unused tokens
    await prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Create new token (24 hour expiry)
    const verificationToken = await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || `https://${request.headers.get('host')}`;
    const verifyUrl = `${baseUrl}/verify-email?token=${verificationToken.token}`;

    await sendEmail({
      to: user.email,
      subject: 'Verify your Splint Factory email',
      react: EmailVerificationEmail({ verifyUrl }),
    });

    return NextResponse.json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Send verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
