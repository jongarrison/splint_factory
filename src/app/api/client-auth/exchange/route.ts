import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encode } from 'next-auth/jwt';

// POST /api/client-auth/exchange - Exchange an approved challenge for a session token
// Called by the Electron client after it detects a challenge has been approved
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { challengeId, deviceId } = body;

    if (!challengeId || !deviceId) {
      return NextResponse.json(
        { error: 'challengeId and deviceId are required' },
        { status: 400 }
      );
    }

    console.log('[Exchange] Attempting exchange for challenge:', challengeId, 'device:', deviceId);

    // Find the approved challenge
    const challenge = await prisma.clientAuthChallenge.findUnique({
      where: { id: challengeId },
      include: {
        authorizedBy: {
          select: { id: true, name: true, email: true, role: true }
        },
        device: {
          select: { id: true }
        },
      },
    });

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Verify the challenge belongs to the requesting device
    if (challenge.device.id !== deviceId) {
      return NextResponse.json({ error: 'Device mismatch' }, { status: 403 });
    }

    // Verify it was approved
    if (!challenge.authorizedAt || !challenge.authorizedBy) {
      return NextResponse.json({ error: 'Challenge not yet approved' }, { status: 400 });
    }

    // Verify it hasn't been exchanged already
    if (challenge.exchangedAt) {
      return NextResponse.json({ error: 'Token already exchanged' }, { status: 410 });
    }

    // Verify it hasn't expired (give extra time since approval already happened)
    const expiryWithGrace = new Date(challenge.expiresAt.getTime() + 5 * 60 * 1000);
    if (expiryWithGrace < new Date()) {
      return NextResponse.json({ error: 'Challenge expired' }, { status: 410 });
    }

    // Mark the exchange token as consumed
    await prisma.clientAuthChallenge.update({
      where: { id: challengeId },
      data: { exchangedAt: new Date() },
    });

    const user = challenge.authorizedBy;

    // Create a JWT session token for the authorized user
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error('No AUTH_SECRET or NEXTAUTH_SECRET found');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const token = await encode({
      token: {
        sub: user.id,
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
      },
      secret,
      salt: 'next-auth.session-token',
    });

    // Set the session cookie on the response
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });

    response.cookies.set('next-auth.session-token', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    });

    console.log('[Exchange] Success - issued session for user:', user.email, 'device:', deviceId);
    return response;
  } catch (error) {
    console.error('Error exchanging auth token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
