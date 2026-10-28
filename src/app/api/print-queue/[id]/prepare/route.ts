import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

  const preparationCutoff = new Date(Date.now() - PREPARATION_LEASE_MS);
  const claimed = await prisma.printJob.updateMany({
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
    data: { printPreparationStartedAt: new Date() },
  });

  if (claimed.count === 0) {
    return NextResponse.json(
      { error: 'Print job is unavailable or already being prepared' },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true });
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