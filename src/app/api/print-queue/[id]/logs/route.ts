import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { logs } = body;

    if (typeof logs !== 'string') {
      return NextResponse.json({ error: 'Invalid logs data' }, { status: 400 });
    }

    // Update the print queue record with logs
    const updated = await prisma.printQueue.update({
      where: { id },
      data: { logs }
    });

    return NextResponse.json({ success: true, id: updated.id });
  } catch (error) {
    console.error('Error updating print queue logs:', error);
    return NextResponse.json(
      { error: 'Failed to update logs' },
      { status: 500 }
    );
  }
}
