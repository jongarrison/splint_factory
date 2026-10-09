import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/printer-snapshots - Record a printer configuration snapshot
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deviceId = request.headers.get('x-device-id');
    if (!deviceId) {
      return NextResponse.json({ error: 'X-Device-ID header required' }, { status: 400 });
    }

    const body = await request.json();
    const { serial, model, firmware, modules, amsConfig, networkIp, activeHmsErrors, funField, rawReport } = body;

    if (!serial || !model || !firmware) {
      return NextResponse.json({ error: 'serial, model, and firmware are required' }, { status: 400 });
    }

    const capturedAt = new Date();

    const snapshot = await prisma.$transaction(async (tx) => {
      const existingPrinter = await tx.printer.findUnique({
        where: { serial },
        include: {
          device: {
            select: {
              id: true,
              name: true,
              organizationId: true,
              organization: { select: { name: true } },
            },
          },
        },
      });
      const device = await tx.clientDevice.findUnique({
        where: { id: deviceId },
        select: {
          id: true,
          name: true,
          organizationId: true,
          organization: { select: { name: true } },
        },
      });

      if (!device) return null;

      const associationChanged = existingPrinter?.deviceId !== deviceId;
      await tx.printer.upsert({
        where: { serial },
        update: {
          model,
          deviceId,
          lastSnapshotAt: capturedAt,
        },
        create: {
          serial,
          model,
          deviceId,
          lastSnapshotAt: capturedAt,
        },
      });

      const createdSnapshot = await tx.printerSnapshot.create({
        data: {
          printerSerial: serial,
          deviceId,
          firmware,
          modules: modules ?? undefined,
          amsConfig: amsConfig ?? undefined,
          networkIp: networkIp ?? undefined,
          activeHmsErrors: activeHmsErrors ?? undefined,
          funField: funField ?? undefined,
          rawReport: rawReport ?? undefined,
          capturedAt,
        },
      });

      await tx.clientDevice.update({
        where: { id: deviceId },
        data: { lastSeenAt: capturedAt },
      });

      if (associationChanged) {
        await tx.auditEvent.create({
          data: {
            eventType: 'PRINTER_DEVICE_CHANGED',
            channel: 'DEVICE',
            actorId: session.user.id,
            organizationId: device.organizationId,
            metadata: {
              printerSerial: serial,
              printerModel: model,
              previousDeviceId: existingPrinter?.deviceId ?? null,
              previousDeviceName: existingPrinter?.device?.name ?? null,
              previousOrganizationId: existingPrinter?.device?.organizationId ?? null,
              previousOrganizationName: existingPrinter?.device?.organization?.name ?? null,
              newDeviceId: device.id,
              newDeviceName: device.name,
              newOrganizationId: device.organizationId,
              newOrganizationName: device.organization?.name ?? null,
              source: 'PRINTER_SNAPSHOT',
            },
          },
        });
      }

      return createdSnapshot;
    });

    if (!snapshot) {
      return NextResponse.json({ error: 'Client device not found' }, { status: 404 });
    }

    return NextResponse.json({ id: snapshot.id, capturedAt: snapshot.capturedAt }, { status: 201 });
  } catch (error) {
    console.error('Error creating printer snapshot:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/printer-snapshots - List printers with latest snapshot (fleet overview)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, organizationId: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const printerSerial = request.nextUrl.searchParams.get('printer');

    // If requesting snapshots for a specific printer, return history
    if (printerSerial) {
      const snapshots = await prisma.printerSnapshot.findMany({
        where: { printerSerial },
        orderBy: { capturedAt: 'desc' },
        take: 50,
      });
      const deviceIds = [...new Set(snapshots.map(snapshot => snapshot.deviceId))];
      const devices = await prisma.clientDevice.findMany({
        where: { id: { in: deviceIds } },
        select: {
          id: true,
          name: true,
          organization: { select: { name: true } },
        },
      });
      const devicesById = new Map(devices.map(device => [device.id, device]));

      return NextResponse.json(snapshots.map(snapshot => {
        const device = devicesById.get(snapshot.deviceId);
        return {
          ...snapshot,
          deviceName: device?.name ?? null,
          organizationName: device?.organization?.name ?? null,
        };
      }));
    }

    // Otherwise return fleet overview: all printers with device + org info
    const printers = await prisma.printer.findMany({
      include: {
        device: {
          select: {
            id: true,
            name: true,
            organizationId: true,
            organization: { select: { name: true } },
          },
        },
        snapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Flatten for the fleet view
    const fleet = printers.map(p => ({
      serial: p.serial,
      model: p.model,
      name: p.name,
      lastSnapshotAt: p.lastSnapshotAt,
      device: p.device ? {
        id: p.device.id,
        name: p.device.name,
        organizationName: p.device.organization?.name ?? null,
      } : null,
      latestSnapshot: p.snapshots[0] ?? null,
    }));

    return NextResponse.json(fleet);
  } catch (error) {
    console.error('Error fetching printer data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
