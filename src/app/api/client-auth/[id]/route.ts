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
          select: {
            id: true,
            name: true,
            organizationId: true,
            organization: { select: { name: true } },
            printers: { select: { serial: true } },
          }
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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        organizationId: true,
        organization: { select: { name: true } },
        name: true,
      }
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: 'You must be part of an organization' },
        { status: 403 }
      );
    }

    // Generate a single-use exchange token
    const crypto = await import('crypto');
    const exchangeToken = crypto.randomUUID();

    const organizationChanged = challenge.device.organizationId !== user.organizationId;

    // Physical access to the QR code authorizes use and updates the device's current placement.
    await prisma.$transaction(async (tx) => {
      await tx.clientAuthChallenge.update({
        where: { id },
        data: {
          authorizedByUserId: session.user.id,
          authorizedAt: new Date(),
          exchangeToken,
        },
      });
      await tx.clientDevice.update({
        where: { id: challenge.device.id },
        data: {
          currentOperatorId: session.user.id,
          operatorValidatedAt: new Date(),
          organizationId: user.organizationId,
        },
      });

      if (organizationChanged) {
        await tx.auditEvent.create({
          data: {
            eventType: 'CLIENT_DEVICE_ORGANIZATION_CHANGED',
            channel: 'DEVICE',
            actorId: session.user.id,
            organizationId: user.organizationId,
            metadata: {
              deviceId: challenge.device.id,
              deviceName: challenge.device.name,
              challengeId: id,
              previousOrganizationId: challenge.device.organizationId,
              previousOrganizationName: challenge.device.organization?.name ?? null,
              newOrganizationId: user.organizationId,
              newOrganizationName: user.organization?.name ?? null,
              attachedPrinterSerials: challenge.device.printers.map(printer => printer.serial),
              source: 'QR_AUTHORIZATION',
            },
          },
        });

        for (const printer of challenge.device.printers) {
          await tx.auditEvent.create({
            data: {
              eventType: 'PRINTER_ORGANIZATION_CHANGED',
              channel: 'DEVICE',
              actorId: session.user.id,
              organizationId: user.organizationId,
              metadata: {
                printerSerial: printer.serial,
                deviceId: challenge.device.id,
                previousOrganizationId: challenge.device.organizationId,
                previousOrganizationName: challenge.device.organization?.name ?? null,
                newOrganizationId: user.organizationId,
                newOrganizationName: user.organization?.name ?? null,
                source: 'DEVICE_REASSIGNMENT',
              },
            },
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Device authorized for ${user.name || session.user.email}`,
    });
  } catch (error) {
    console.error('Error approving challenge:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
