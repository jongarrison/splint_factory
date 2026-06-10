import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getBlobStorageInstance } from '@/lib/blob-storage';

// POST /api/print-queue/[id]/photos - Upload a print bed photo from splint_client
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const printJob = await prisma.printJob.findUnique({
      where: { id },
      include: { designJob: { select: { owningOrganizationId: true } } },
    });

    if (!printJob) {
      return NextResponse.json({ error: 'Print job not found' }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });

    if (printJob.designJob.owningOrganizationId !== user?.organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const formData = await request.formData();
    const photo = formData.get('photo') as File | null;
    const progressStr = formData.get('progress') as string | null;

    if (!photo || !progressStr) {
      return NextResponse.json({ error: 'photo and progress are required' }, { status: 400 });
    }

    const progress = parseFloat(progressStr);
    if (isNaN(progress) || progress < 0 || progress > 100) {
      return NextResponse.json({ error: 'Invalid progress value' }, { status: 400 });
    }

    const buffer = Buffer.from(await photo.arrayBuffer());
    const filename = `print-${id}-${Math.round(progress)}pct.jpg`;

    const storage = getBlobStorageInstance();
    const uploadResult = await storage.upload(buffer, filename);

    const photoRecord = await prisma.printJobPhoto.create({
      data: {
        printJobId: id,
        photoUrl: uploadResult.url,
        photoPathname: uploadResult.pathname,
        progress,
      },
    });

    return NextResponse.json({
      id: photoRecord.id,
      photoUrl: photoRecord.photoUrl,
      progress: photoRecord.progress,
      capturedAt: photoRecord.capturedAt,
    });
  } catch (error) {
    console.error('Error uploading print job photo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
