import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/client-auth/login-challenge
// Called by the Electron login page to create a QR challenge without a session.
// Auto-registers the device (with null org) if not already registered.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, deviceName } = body;

    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
    }

    // Upsert device -- create with null org if new, just touch lastSeenAt if existing
    await prisma.clientDevice.upsert({
      where: { id: deviceId },
      update: { lastSeenAt: new Date() },
      create: {
        id: deviceId,
        name: deviceName || 'Unknown Device',
        // organizationId left null -- will be set on first QR approval
      },
    });

    // Expire any pending challenges for this device
    await prisma.clientAuthChallenge.updateMany({
      where: {
        deviceId,
        authorizedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { expiresAt: new Date() },
    });

    // Create a new challenge (5 minute TTL)
    const challenge = await prisma.clientAuthChallenge.create({
      data: {
        deviceId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    return NextResponse.json({
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Error creating login challenge:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
