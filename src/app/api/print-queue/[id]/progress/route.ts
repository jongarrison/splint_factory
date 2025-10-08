import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { broadcastPrintQueueUpdate } from '../../events/route';

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
    const { progress, filename } = body;

    // Validate input
    if (typeof progress !== 'number' || progress < 0 || progress > 100) {
      return NextResponse.json({ error: 'Invalid progress value' }, { status: 400 });
    }

    // Find the print queue entry by ID
    // TODO: In the future, we could match by filename if needed
    const printQueueEntry = await prisma.printQueue.findUnique({
      where: { id },
      include: {
        geometryProcessingQueue: {
          include: {
            geometry: true,
          },
        },
      },
    });

    if (!printQueueEntry) {
      return NextResponse.json({ error: 'Print queue entry not found' }, { status: 404 });
    }

    // Update the progress
    const updatedEntry = await prisma.printQueue.update({
      where: { id: printQueueEntry.id },
      data: {
        progress,
        progressLastReportTime: new Date(),
      } as any, // Type assertion needed until Prisma Client regenerates
      include: {
        geometryProcessingQueue: {
          include: {
            geometry: true,
            creator: true,
            owningOrganization: true,
          },
        },
      },
    });

    // Broadcast the update to all connected clients
    broadcastPrintQueueUpdate({
      type: 'progress',
      id: updatedEntry.id,
      progress,
      progressLastReportTime: (updatedEntry as any).progressLastReportTime,
    });

    return NextResponse.json({ 
      success: true,
      id: updatedEntry.id,
      progress: (updatedEntry as any).progress,
    });
  } catch (error) {
    console.error('Error updating print progress:', error);
    return NextResponse.json(
      { error: 'Failed to update print progress' },
      { status: 500 }
    );
  }
}
