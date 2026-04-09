import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/client-auth/[id] - Get challenge info
// Two modes:
//   1. Phone user: requires session auth, returns device info for approval page
//   2. Device status check: ?status=true with X-Device-ID header, returns approval status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const isStatusCheck = url.searchParams.get('status') === 'true';
    const deviceIdHeader = request.headers.get('x-device-id');

    // Status check mode: device polling to see if challenge was approved
    if (isStatusCheck && deviceIdHeader) {
      const challenge = await prisma.clientAuthChallenge.findUnique({
        where: { id },
        include: {
          device: { select: { id: true } },
          authorizedBy: { select: { name: true } },
        },
      });

      if (!challenge || challenge.device.id !== deviceIdHeader) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      return NextResponse.json({
        challengeId: challenge.id,
        authorizedAt: challenge.authorizedAt?.toISOString() || null,
        authorizedBy: challenge.authorizedBy ? { name: challenge.authorizedBy.name } : null,
        expired: challenge.expiresAt < new Date(),
      });
    }

    // Phone user mode: requires session auth
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const challenge = await prisma.clientAuthChallenge.findUnique({
      where: { id },
      include: {
        device: {
          select: { id: true, name: true, organizationId: true }
        },
      },
    });

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    if (challenge.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Challenge expired' }, { status: 410 });
    }

    if (challenge.authorizedAt) {
      return NextResponse.json({ error: 'Challenge already used' }, { status: 410 });
    }

    return NextResponse.json({
      challengeId: challenge.id,
      deviceName: challenge.device.name,
      deviceId: challenge.device.id,
      expiresAt: challenge.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching challenge:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/client-auth/[id] - Approve a challenge (called by phone user)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const challenge = await prisma.clientAuthChallenge.findUnique({
      where: { id },
      include: {
        device: {
          select: { id: true, organizationId: true }
        },
      },
    });

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    if (challenge.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Challenge expired' }, { status: 410 });
    }

    if (challenge.authorizedAt) {
      return NextResponse.json({ error: 'Challenge already used' }, { status: 410 });
    }

    // Verify user belongs to the same organization as the device
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true, name: true, role: true }
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: 'You must be part of an organization' },
        { status: 403 }
      );
    }

    const isSystemAdmin = user.role === 'SYSTEM_ADMIN';
    const deviceHasOrg = !!challenge.device.organizationId;
    const sameOrg = user.organizationId === challenge.device.organizationId;

    // If device already has an org, verify same-org (SYSTEM_ADMINs can reassign)
    if (deviceHasOrg && !sameOrg && !isSystemAdmin) {
      return NextResponse.json(
        { error: 'You must be in the same organization as this device' },
        { status: 403 }
      );
    }

    // Generate a single-use exchange token
    const crypto = await import('crypto');
    const exchangeToken = crypto.randomUUID();

    // Authorize the challenge and set the user as current operator on the device
    // Reassign device org if: first-run (no org), or SYSTEM_ADMIN switching orgs
    const shouldUpdateOrg = !deviceHasOrg || (isSystemAdmin && !sameOrg);
    await prisma.$transaction([
      prisma.clientAuthChallenge.update({
        where: { id },
        data: {
          authorizedByUserId: session.user.id,
          authorizedAt: new Date(),
          exchangeToken,
        },
      }),
      prisma.clientDevice.update({
        where: { id: challenge.device.id },
        data: {
          currentOperatorId: session.user.id,
          operatorValidatedAt: new Date(),
          ...(shouldUpdateOrg ? { organizationId: user.organizationId } : {}),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: `Device authorized for ${user.name || session.user.email}`,
    });
  } catch (error) {
    console.error('Error approving challenge:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
