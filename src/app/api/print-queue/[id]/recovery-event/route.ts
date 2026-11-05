import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const RECOVERY_EVENT_TYPES = new Set([
  'PRINT_AUTO_STOP_SENT',
  'PRINT_OPERATOR_STOP_SENT',
  'PRINT_STOP_VERIFIED',
  'PRINT_STOP_ESCALATED',
  'PRINT_RECOVERY_VERIFIED',
]);

/**
 * Persist one idempotent audit fact for a manager-owned printer recovery transition.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { eventKey, eventType, evidence } = body;
  if (typeof eventKey !== 'string' || !eventKey ||
      typeof eventType !== 'string' || !RECOVERY_EVENT_TYPES.has(eventType) ||
      !evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return NextResponse.json({ error: 'Valid eventKey, eventType, and evidence are required' }, { status: 400 });
  }

  const [user, printJob] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true, role: true },
    }),
    prisma.printJob.findUnique({
      where: { id },
      include: { designJob: { select: { owningOrganizationId: true } } },
    }),
  ]);
  if (!user || !printJob ||
      (user.role !== 'SYSTEM_ADMIN' && printJob.designJob.owningOrganizationId !== user.organizationId)) {
    return NextResponse.json({ error: 'Print job not found or access denied' }, { status: 404 });
  }

  const actorId = eventType === 'PRINT_OPERATOR_STOP_SENT' ? session.user.id : null;

  try {
    const auditEvent = await prisma.auditEvent.create({
      data: {
        eventKey,
        eventType,
        channel: 'PRINTING',
        actorId,
        organizationId: printJob.designJob.owningOrganizationId,
        designJobId: printJob.designJobId,
        clientDeviceId: request.headers.get('x-device-id'),
        printerSerial: printJob.printerSerial,
        printJobId: id,
        metadata: evidence as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    return NextResponse.json({ auditEvent, created: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const auditEvent = await prisma.auditEvent.findUnique({
        where: { eventKey },
        select: { id: true },
      });
      return NextResponse.json({ auditEvent, created: false });
    }
    console.error('Failed to persist printer recovery event:', error);
    return NextResponse.json({ error: 'Failed to persist recovery event' }, { status: 500 });
  }
}
