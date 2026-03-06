import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/client-devices/register - Register or update a client device
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { deviceId, name } = body;

    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
    }

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true }
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'User must be part of an organization' }, { status: 403 });
    }

    // Upsert the device - create if new, update lastSeenAt if existing
    // If device exists with no org (pre-registered via login-challenge), we assign org below
    const device = await prisma.clientDevice.upsert({
      where: { id: deviceId },
      update: {
        lastSeenAt: new Date(),
        // Don't change org here -- handled below for null-org devices
      },
      create: {
        id: deviceId,
        name: name || 'Unknown Device',
        organizationId: user.organizationId,
      },
      include: {
        organization: { select: { name: true } },
        currentOperator: { select: { id: true, name: true, email: true } },
      }
    });

    // If device has no org (pre-registered via login-challenge), assign it now
    if (!device.organizationId) {
      const updated = await prisma.clientDevice.update({
        where: { id: deviceId },
        data: { organizationId: user.organizationId },
        include: {
          organization: { select: { name: true } },
          currentOperator: { select: { id: true, name: true, email: true } },
        }
      });
      return NextResponse.json({
        id: updated.id,
        name: updated.name,
        organizationName: updated.organization?.name || null,
        currentOperator: updated.currentOperator ? {
          id: updated.currentOperator.id,
          name: updated.currentOperator.name,
          email: updated.currentOperator.email,
        } : null,
        operatorValidatedAt: updated.operatorValidatedAt,
      });
    }

    // Verify device belongs to user's org (handles case where device was already registered to another org)
    if (device.organizationId !== user.organizationId) {
      return NextResponse.json(
        { error: 'Device is registered to a different organization' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      id: device.id,
      name: device.name,
      organizationName: device.organization?.name || null,
      currentOperator: device.currentOperator ? {
        id: device.currentOperator.id,
        name: device.currentOperator.name,
        email: device.currentOperator.email,
      } : null,
      operatorValidatedAt: device.operatorValidatedAt,
    });
  } catch (error) {
    console.error('Error registering client device:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
