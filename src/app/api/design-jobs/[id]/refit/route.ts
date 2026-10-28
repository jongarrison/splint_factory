import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getBlobStorageInstance } from '@/lib/blob-storage';
import { prisma } from '@/lib/prisma';
import { getDesignById } from '@/designs/registry';
import { validateDesignInput } from '@/designs/validate-input';

const PREPARATION_LEASE_MS = 10 * 60 * 1000;

function changedParameterNames(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
): string[] {
  return Array.from(new Set([...Object.keys(previous), ...Object.keys(next)]))
    .filter(key => JSON.stringify(previous[key]) !== JSON.stringify(next[key]))
    .sort();
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true, role: true },
    });
    if (!user || (user.role !== 'SYSTEM_ADMIN' && !user.organizationId)) {
      return NextResponse.json({ error: 'User must be part of an organization' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const inputParameters = body.inputParameters;
    const jobLabel = body.jobLabel;

    if (typeof inputParameters !== 'string') {
      return NextResponse.json({ error: 'inputParameters is required' }, { status: 400 });
    }
    if (jobLabel !== undefined && jobLabel !== null && typeof jobLabel !== 'string') {
      return NextResponse.json({ error: 'Print Queue Label must be text' }, { status: 400 });
    }
    if (typeof jobLabel === 'string' && jobLabel.length > 20) {
      return NextResponse.json({ error: 'Print Queue Label must be 20 characters or less' }, { status: 400 });
    }

    const existingJob = await prisma.designJob.findUnique({
      where: { id },
      select: {
        id: true,
        designId: true,
        owningOrganizationId: true,
        inputParameters: true,
        jobLabel: true,
        revision: true,
        processStartedAt: true,
        processCompletedAt: true,
        meshBlobPathname: true,
        printBlobPathname: true,
      },
    });
    if (!existingJob) {
      return NextResponse.json({ error: 'Design job not found' }, { status: 404 });
    }
    if (user.role !== 'SYSTEM_ADMIN' && existingJob.owningOrganizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    if (!existingJob.processCompletedAt) {
      return NextResponse.json(
        { error: existingJob.processStartedAt ? 'Design job is still processing' : 'Design job has not finished processing' },
        { status: 409 },
      );
    }

    const registryDesign = getDesignById(existingJob.designId);
    if (!registryDesign) {
      return NextResponse.json({ error: 'Design definition not found in registry' }, { status: 404 });
    }
    if (registryDesign.category === 'tool') {
      return NextResponse.json({ error: 'Tool designs cannot be refit' }, { status: 400 });
    }

    let nextInputData: Record<string, unknown>;
    let previousInputData: Record<string, unknown>;
    try {
      nextInputData = JSON.parse(inputParameters) as Record<string, unknown>;
      previousInputData = JSON.parse(existingJob.inputParameters) as Record<string, unknown>;
      validateDesignInput(registryDesign, nextInputData);
    } catch (validationError) {
      return NextResponse.json(
        { error: `Invalid design input parameters: ${validationError}` },
        { status: 400 },
      );
    }

    const preparationCutoff = new Date(Date.now() - PREPARATION_LEASE_MS);
    const nextRevision = existingJob.revision + 1;
    const normalizedJobLabel = jobLabel === undefined
      ? existingJob.jobLabel
      : (jobLabel?.trim() || null);

    const result = await prisma.$transaction(async tx => {
      const preparingPrint = await tx.printJob.findFirst({
        where: {
          designJobId: id,
          printPreparationStartedAt: { gte: preparationCutoff },
          printStartedAt: null,
        },
        select: { id: true },
      });
      if (preparingPrint) {
        throw new Error('PRINT_PREPARING');
      }

      const pendingPrints = await tx.printJob.findMany({
        where: {
          designJobId: id,
          isEnabled: true,
          printStartedAt: null,
          printCompletedAt: null,
          OR: [
            { printPreparationStartedAt: null },
            { printPreparationStartedAt: { lt: preparationCutoff } },
          ],
        },
        select: { id: true },
      });

      if (pendingPrints.length > 0) {
        await tx.printJob.updateMany({
          where: { id: { in: pendingPrints.map(print => print.id) } },
          data: { isEnabled: false, printPreparationStartedAt: null },
        });
      }

      const updated = await tx.designJob.updateMany({
        where: { id, revision: existingJob.revision, processCompletedAt: { not: null } },
        data: {
          inputParameters,
          jobLabel: normalizedJobLabel,
          revision: nextRevision,
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
          generatorVersionSnapshot: null,
          isEnabled: true,
        },
      });
      if (updated.count === 0) {
        throw new Error('JOB_CHANGED');
      }

      await tx.auditEvent.create({
        data: {
          eventType: 'DESIGN_JOB_REFIT_REQUESTED',
          channel: 'PROCESSING',
          actorId: session.user.id,
          organizationId: existingJob.owningOrganizationId,
          designJobId: id,
          metadata: {
            previousRevision: existingJob.revision,
            revision: nextRevision,
            changedParameterNames: changedParameterNames(previousInputData, nextInputData),
            jobLabelChanged: existingJob.jobLabel !== normalizedJobLabel,
            retiredPrintJobIds: pendingPrints.map(print => print.id),
          },
        },
      });

      return {
        updatedJob: { id, revision: nextRevision },
        retiredPrintCount: pendingPrints.length,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const blobStorage = getBlobStorageInstance();
    const staleBlobPaths = [existingJob.meshBlobPathname, existingJob.printBlobPathname]
      .filter((pathname): pathname is string => Boolean(pathname));
    await Promise.all(staleBlobPaths.map(pathname => blobStorage.delete(pathname).catch(error => {
      console.error(`Failed to delete stale refit blob ${pathname}:`, error);
    })));

    return NextResponse.json({
      message: 'Design job queued for refitting',
      job: result.updatedJob,
      retiredPrintCount: result.retiredPrintCount,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'PRINT_PREPARING') {
      return NextResponse.json(
        { error: 'Wait for print preparation to finish before refitting' },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.message === 'JOB_CHANGED') {
      return NextResponse.json({ error: 'Design job changed; please reload and try again' }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json({ error: 'Design job changed; please try again' }, { status: 409 });
    }
    console.error('Error refitting design job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}