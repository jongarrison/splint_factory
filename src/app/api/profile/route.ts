import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { validatePassword } from '@/lib/password';
import { sendEmail } from '@/lib/email';
import EmailVerificationEmail from '@/emails/email-verification';

// GET /api/profile - Get current user's profile
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            description: true,
          }
        },
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/profile - Update current user's profile
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, email, currentPassword, newPassword } = body;

    // Basic validation
    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    if (!email.includes('@')) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // If password update is requested, validate passwords
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required to change password' },
          { status: 400 }
        );
      }

      const passwordCheck = validatePassword(newPassword);
      if (!passwordCheck.valid) {
        return NextResponse.json(
          { error: passwordCheck.errors.join('. ') },
          { status: 400 }
        );
      }

      // Verify current password
      const currentUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { password: true },
      });

      if (!currentUser?.password) {
        return NextResponse.json(
          { error: 'No password set for this account' },
          { status: 400 }
        );
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentUser.password);
      if (!isCurrentPasswordValid) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 400 }
        );
      }
    }

    // Check if email is already taken by another user
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        NOT: { email: session.user.email },
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already in use' },
        { status: 409 }
      );
    }

    // Prepare update data
    const emailChanged = email !== session.user.email;
    const updateData: {
      name: string;
      email: string;
      updatedAt: Date;
      password?: string;
      emailVerified?: null;
    } = {
      name,
      email,
      updatedAt: new Date(),
    };

    // Hash new password if provided
    if (newPassword) {
      updateData.password = await bcrypt.hash(newPassword, 12);
    }

    // Reset verification if email changed
    if (emailChanged) {
      updateData.emailVerified = null;
    }

    // Update the user
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            description: true,
          }
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    // Send verification email for new address
    if (emailChanged) {
      const verificationToken = await prisma.emailVerificationToken.create({
        data: {
          userId: updatedUser.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const baseUrl = process.env.NEXTAUTH_URL || `https://${request.headers.get('host')}`;
      const verifyUrl = `${baseUrl}/verify-email?token=${verificationToken.token}`;

      await sendEmail({
        to: email,
        subject: 'Verify your new Splint Factory email',
        react: EmailVerificationEmail({ verifyUrl }),
      });
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
