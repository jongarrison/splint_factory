import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateObjectId } from '@/lib/objectId';
import { getDesignById } from '@/designs/registry';

// POST /api/designs/[id]/quick-run - Entry point for 'tool' category designs (no input form).
//
// Tool designs (e.g. Sizing Rings) have no per-patient parameters, so their geometry is
// identical for everyone at a given generatorVersion. Rather than reprocessing through the
// geo processor on every click, this resolves to one of three outcomes:
//
//   1. This org already has a current-version completed job -> just queue a new PrintJob.
//   2. Some other org already has a current-version completed job -> clone that job's
//      file references (blob URLs, not the underlying files) into a new job owned by this
//      org, marked complete immediately, then queue a PrintJob. No geo processing involved.
//   3. Nobody has run this generatorVersion yet -> create a normal job and submit it to the
//      geo processor as usual. The existing /api/design-processing/result handler already
//      auto-creates the first PrintJob once processing succeeds.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: designId } = await params;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'User must be part of an organization' }, { status: 403 });
    }

    const design = getDesignById(designId);
    if (!design) {
      return NextResponse.json({ error: 'Design not found' }, { status: 404 });
    }
    if (design.category !== 'tool') {
      return NextResponse.json({ error: 'This endpoint is only for tool-category designs' }, { status: 400 });
    }
    if (!design.isActive) {
      return NextResponse.json({ error: 'Design is not active' }, { status: 400 });
    }

    // Org visibility check, mirrors GET /api/designs
    const visible = await prisma.organizationDesign.findUnique({
      where: {
        organizationId_designId: {
          organizationId: user.organizationId,
          designId,
        },
      },
    });
    if (!visible) {
      return NextResponse.json({ error: 'Design not available to your organization' }, { status: 403 });
    }

    const generatorVersion = design.generatorVersion;

    // Path 1: this org already has a current-version completed job for this tool
    const ownJob = await prisma.designJob.findFirst({
      where: {
        designId,
        owningOrganizationId: user.organizationId,
        isProcessSuccessful: true,
        isEnabled: true,
        generatorVersionSnapshot: generatorVersion,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (ownJob) {
      const printJob = await prisma.printJob.create({ data: { designJobId: ownJob.id } });
      return NextResponse.json({ mode: 'print', printJobId: printJob.id }, { status: 201 });
    }

    // Path 2: another org already has a current-version completed job - clone its file
    // references (blob URLs are stable, immutable content; no re-upload needed).
    const template = await prisma.designJob.findFirst({
      where: {
        designId,
        isProcessSuccessful: true,
        isEnabled: true,
        generatorVersionSnapshot: generatorVersion,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (template) {
      const objectId = await generateObjectId();
      const now = new Date();
      const cloned = await prisma.designJob.create({
        data: {
          designId,
          creatorId: session.user.id,
          owningOrganizationId: user.organizationId,
          inputParameters: '{}',
          jobLabel: design.name,
          isEnabled: true,
          objectId,
          objectIdGeneratedAt: now,
          processStartedAt: now,
          processCompletedAt: now,
          isProcessSuccessful: true,
          generatorVersionSnapshot: generatorVersion,
          meshFileName: template.meshFileName,
          meshBlobUrl: template.meshBlobUrl,
          meshBlobPathname: template.meshBlobPathname,
          printFileName: template.printFileName,
          printBlobUrl: template.printBlobUrl,
          printBlobPathname: template.printBlobPathname,
          meshMetadata: template.meshMetadata,
          processingLog: `Cloned from job ${template.id} (generatorVersion=${generatorVersion}); not independently processed.`,
        },
      });

      const printJob = await prisma.printJob.create({ data: { designJobId: cloned.id } });
      return NextResponse.json({ mode: 'print', printJobId: printJob.id }, { status: 201 });
    }

    // Path 3: true first-ever run for this generatorVersion - submit to the geo processor.
    // /api/design-processing/result will auto-create the first PrintJob on success.
    const objectId = await generateObjectId();
    const designJob = await prisma.designJob.create({
      data: {
        designId,
        creatorId: session.user.id,
        owningOrganizationId: user.organizationId,
        inputParameters: '{}',
        jobLabel: design.name,
        isEnabled: true,
        objectId,
        objectIdGeneratedAt: new Date(),
        generatorVersionSnapshot: generatorVersion,
      },
    });

    return NextResponse.json({ mode: 'processing', designJobId: designJob.id }, { status: 201 });
  } catch (error) {
    console.error('Error running tool design:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
