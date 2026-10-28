import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const [user, designJob] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true, role: true },
    }),
    prisma.designJob.findUnique({
      where: { id },
      select: { owningOrganizationId: true },
    }),
  ]);

  if (!designJob) {
    return NextResponse.json({ error: 'Design job not found' }, { status: 404 });
  }
  if (!user || (user.role !== 'SYSTEM_ADMIN' && designJob.owningOrganizationId !== user.organizationId)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const events = await prisma.auditEvent.findMany({
    where: { designJobId: id },
    orderBy: { timestamp: 'desc' },
    take: 100,
    select: {
      id: true,
      timestamp: true,
      eventType: true,
      channel: true,
      metadata: true,
      actor: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(events);
}