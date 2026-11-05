import { NextRequest, NextResponse } from 'next/server';
import { Prisma, PrintOutcome } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ALLOWED_OUTCOMES = new Set<PrintOutcome>([
  'FAILED',
  'OPERATOR_CANCELLED',
  'AMBIGUOUS_STOP',
]);
type FailureOutcome = Exclude<PrintOutcome, 'SUCCEEDED'>;

function getDetectionMetadata(evidence: Record<string, unknown>, printJobId: string) {
  const printer = evidence.printer;
  if (!printer || typeof printer !== 'object' || Array.isArray(printer)) return [];
  const intervals = (printer as Record<string, unknown>).intervals;
  if (!intervals || typeof intervals !== 'object' || Array.isArray(intervals)) return [];

  const intervalGroups = intervals as Record<string, unknown>;
  const belongsToPrint = (interval: unknown) =>
    interval !== null &&
    typeof interval === 'object' &&
    !Array.isArray(interval) &&
    (interval as Record<string, unknown>).printJobId === printJobId;
  return [
    ...((Array.isArray(intervalGroups.hms) ? intervalGroups.hms : [])
      .filter(belongsToPrint)
      .map((interval) => ({ kind: 'hms', interval }))),
    ...((Array.isArray(intervalGroups.printErrors) ? intervalGroups.printErrors : [])
      .filter(belongsToPrint)
      .map((interval) => ({ kind: 'print_error', interval }))),
  ];
}

/**
 * Atomically retain failure evidence and return the one replacement linked to an original print.
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
  const requestedClassification = body.classification as PrintOutcome;
  const evidence = body.evidence;
  const idempotencyKey = body.idempotencyKey;

  if (!ALLOWED_OUTCOMES.has(requestedClassification) || !idempotencyKey || typeof idempotencyKey !== 'string') {
    return NextResponse.json({ error: 'Valid idempotencyKey and classification are required' }, { status: 400 });
  }
  const classification = requestedClassification as FailureOutcome;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return NextResponse.json({ error: 'Failure evidence is required' }, { status: 400 });
  }
  if (JSON.stringify(evidence).length > 1_000_000) {
    return NextResponse.json({ error: 'Failure evidence exceeds 1 MB' }, { status: 413 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true, role: true },
  });
  const original = await prisma.printJob.findUnique({
    where: { id },
    include: { designJob: { select: { owningOrganizationId: true } } },
  });
  if (!user || !original ||
      (user.role !== 'SYSTEM_ADMIN' && original.designJob.owningOrganizationId !== user.organizationId)) {
    return NextResponse.json({ error: 'Print job not found or access denied' }, { status: 404 });
  }

  const clientDeviceId = request.headers.get('x-device-id');
  const detectionMetadata = getDetectionMetadata(evidence, id);
  const outcomeEventTypes: Record<FailureOutcome, string> = {
    FAILED: 'PRINT_FAILED',
    OPERATOR_CANCELLED: 'PRINT_OPERATOR_CANCELLED',
    AMBIGUOUS_STOP: 'PRINT_AMBIGUOUS_STOP',
  };
  const outcomeEventType = outcomeEventTypes[classification];
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.printJob.findUnique({
        where: { replacementForPrintJobId: id },
      });
      if (existing) return { replacement: existing, created: false };

      await tx.printJob.update({
        where: { id },
        data: {
          outcome: classification,
          failureEvidence: evidence as Prisma.InputJsonObject,
          printCompletedAt: original.printCompletedAt || new Date(),
          isPrintSuccessful: false,
          printPreparationStartedAt: null,
        },
      });

      const replacement = await tx.printJob.create({
        data: {
          designJobId: original.designJobId,
          designRevision: original.designRevision,
          inputParametersSnapshot: original.inputParametersSnapshot,
          printerSerial: original.printerSerial,
          replacementForPrintJobId: id,
        },
      });

      await tx.auditEvent.createMany({
        data: [
          ...detectionMetadata.map((metadata) => ({
            eventType: 'PRINTER_ERROR_DETECTED',
            channel: 'PRINTING',
            actorId: null,
            organizationId: original.designJob.owningOrganizationId,
            designJobId: original.designJobId,
            clientDeviceId,
            printerSerial: original.printerSerial,
            printJobId: id,
            metadata,
          })),
          {
            eventType: outcomeEventType,
            channel: 'PRINTING',
            actorId: session.user.id,
            organizationId: original.designJob.owningOrganizationId,
            designJobId: original.designJobId,
            clientDeviceId,
            printerSerial: original.printerSerial,
            printJobId: id,
            metadata: { classification, idempotencyKey },
          },
          {
            eventType: 'PRINT_REPLACEMENT_CREATED',
            channel: 'PRINTING',
            actorId: session.user.id,
            organizationId: original.designJob.owningOrganizationId,
            designJobId: original.designJobId,
            clientDeviceId,
            printerSerial: original.printerSerial,
            printJobId: replacement.id,
            metadata: { originalPrintJobId: id, idempotencyKey },
          },
        ],
      });
      return { replacement, created: true };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const replacement = await prisma.printJob.findUnique({
        where: { replacementForPrintJobId: id },
      });
      if (replacement) return NextResponse.json({ replacement, created: false });
    }
    console.error('Failed to fail and replace print:', error);
    return NextResponse.json({ error: 'Failed to record print failure' }, { status: 500 });
  }
}
