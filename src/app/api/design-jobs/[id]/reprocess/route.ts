import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getBlobStorageInstance } from '@/lib/blob-storage';

// POST /api/design-jobs/[id]/reprocess - Reset job state so geo processor picks it up again
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // System admin only
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        organizationId: true,
        role: true,
      },
    });

    if (user?.role !== 'SYSTEM_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const existingJob = await prisma.designJob.findUnique({
      where: { id },
      select: {
        id: true,
        meshBlobPathname: true,
        printBlobPathname: true,
      },
    });

    if (!existingJob) {
      return NextResponse.json({ error: 'Design job not found' }, { status: 404 });
    }

    // Delete any previously uploaded blob files so they don't become orphans
    const blobStorage = getBlobStorageInstance();
    const deletePromises: Promise<void>[] = [];
    if (existingJob.meshBlobPathname) {
      deletePromises.push(blobStorage.delete(existingJob.meshBlobPathname));
    }
    if (existingJob.printBlobPathname) {
      deletePromises.push(blobStorage.delete(existingJob.printBlobPathname));
    }
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
      console.log(`Deleted ${deletePromises.length} blob file(s) for design job ${id} before reprocessing`);
    }

    // Reset processing state so the geo processor will pick it up on next poll
    const updatedJob = await prisma.designJob.update({
      where: { id },
      data: {
        processStartedAt: null,
        processCompletedAt: null,
        isProcessSuccessful: false,
        processingLog: null,
        meshMetadata: null,
        meshBlobUrl: null,
        meshBlobPathname: null,
        meshFileName: null,
        meshFileContents: null,
        printBlobUrl: null,
        printBlobPathname: null,
        printFileName: null,
        printFileContents: null,
        isEnabled: true,
      },
    });

    console.log(`Reprocess requested for design job ${id} by user ${session.user.id}`);

    return NextResponse.json({
      message: 'Job queued for reprocessing',
      job: {
        id: updatedJob.id,
        isEnabled: updatedJob.isEnabled,
        processStartedAt: updatedJob.processStartedAt,
        processCompletedAt: updatedJob.processCompletedAt,
      },
    });
  } catch (error) {
    console.error('Error reprocessing design job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
