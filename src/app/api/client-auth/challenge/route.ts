import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/client-auth/challenge - Create an auth challenge for a device
// Called by the splint_client (Electron) when it needs to show a QR code
// Does NOT require a session -- authenticates via deviceId (registered device)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId } = body;

    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
    }

    // Verify device exists
    const device = await prisma.clientDevice.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      return NextResponse.json({ error: 'Device not registered' }, { status: 404 });
    }

    // Expire any existing pending challenges for this device
    await prisma.clientAuthChallenge.updateMany({
      where: {
        deviceId,
        authorizedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        expiresAt: new Date(), // expire them now
      },
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
    console.error('Error creating auth challenge:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
