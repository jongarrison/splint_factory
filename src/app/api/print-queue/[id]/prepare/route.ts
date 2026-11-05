import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

const PREPARATION_LEASE_MS = 10 * 60 * 1000;

async function authorizedPrintJob(userId: string, printJobId: string) {
  const [user, printJob] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, role: true },
    }),
    prisma.printJob.findUnique({
      where: { id: printJobId },
      select: {
        id: true,
        designJob: { select: { owningOrganizationId: true } },
      },
    }),
  ]);

  if (!user || !printJob) return null;
  if (user.role !== 'SYSTEM_ADMIN' && printJob.designJob.owningOrganizationId !== user.organizationId) {
    return null;
  }
  return printJob;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!await authorizedPrintJob(session.user.id, id)) {
    return NextResponse.json({ error: 'Print job not found or access denied' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const printerSerial = body?.printerSerial;
  if (!printerSerial || typeof printerSerial !== 'string') {
    return NextResponse.json({ error: 'Printer serial is required' }, { status: 400 });
  }

  const preparationCutoff = new Date(Date.now() - PREPARATION_LEASE_MS);
  try {
    const claimed = await prisma.$transaction(async (tx) => {
      const competing = await tx.printJob.findFirst({
        where: {
          id: { not: id },
          printerSerial,
          isEnabled: true,
          printCompletedAt: null,
          OR: [
            { printStartedAt: { not: null } },
            { printPreparationStartedAt: { gte: preparationCutoff } },
          ],
        },
        select: { id: true },
      });
      if (competing) return { count: 0 };

      return tx.printJob.updateMany({
        where: {
          id,
          isEnabled: true,
          printStartedAt: null,
          printCompletedAt: null,
          OR: [
            { printPreparationStartedAt: null },
            { printPreparationStartedAt: { lt: preparationCutoff } },
          ],
        },
        data: { printPreparationStartedAt: new Date(), printerSerial },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (claimed.count === 0) {
      return NextResponse.json(
        { error: 'Printer or print job is unavailable or already being prepared' },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json({ error: 'Printer is already being prepared' }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!await authorizedPrintJob(session.user.id, id)) {
    return NextResponse.json({ error: 'Print job not found or access denied' }, { status: 404 });
  }

  await prisma.printJob.updateMany({
    where: { id, printStartedAt: null },
    data: { printPreparationStartedAt: null },
  });

  return NextResponse.json({ success: true });
}