import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/organizations/[id]/devices - List devices for an organization
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify user has access (same org or system admin)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.role !== 'SYSTEM_ADMIN' && user.organizationId !== id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const devices = await prisma.clientDevice.findMany({
      where: { organizationId: id },
      include: {
        currentOperator: {
          select: { id: true, name: true, email: true }
        },
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    return NextResponse.json(devices.map(d => ({
      id: d.id,
      name: d.name,
      currentOperator: d.currentOperator ? {
        name: d.currentOperator.name,
        email: d.currentOperator.email,
      } : null,
      operatorValidatedAt: d.operatorValidatedAt,
      lastSeenAt: d.lastSeenAt,
      createdAt: d.createdAt,
    })));
  } catch (error) {
    console.error('Error fetching devices:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
