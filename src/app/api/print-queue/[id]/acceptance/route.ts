import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/print-queue/[id]/acceptance - Accept or reject a print
// Valid printAcceptance values: ACCEPTED, REJECT_DESIGN, REJECT_PRINT
const VALID_ACCEPTANCE_VALUES = ['ACCEPTED', 'REJECT_DESIGN', 'REJECT_PRINT'] as const;
type PrintAcceptanceValue = typeof VALID_ACCEPTANCE_VALUES[number];

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
    const body = await request.json();
    
    const { printAcceptance, printNote } = body;

    // Validate printAcceptance is a valid enum string
    if (!VALID_ACCEPTANCE_VALUES.includes(printAcceptance)) {
      return NextResponse.json(
        { error: `printAcceptance must be one of: ${VALID_ACCEPTANCE_VALUES.join(', ')}` },
        { status: 400 }
      );
    }

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true }
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: 'User must be part of an organization' },
        { status: 403 }
      );
    }

    // Verify print job exists and belongs to user's organization
    const printJob = await prisma.printQueue.findUnique({
      where: { id },
      include: {
        geometryProcessingQueue: {
          select: {
            OwningOrganizationID: true
          }
        }
      }
    });

    if (!printJob) {
      return NextResponse.json({ error: 'Print job not found' }, { status: 404 });
    }

    if (printJob.geometryProcessingQueue.OwningOrganizationID !== user.organizationId) {
      return NextResponse.json(
        { error: 'Print job belongs to different organization' },
        { status: 403 }
      );
    }

    // Verify print is completed (progress > 99%)
    if (!printJob.progress || printJob.progress <= 99) {
      return NextResponse.json(
        { error: 'Print must be completed (progress > 99%) before acceptance decision' },
        { status: 400 }
      );
    }

    // Verify print hasn't already been accepted/rejected
    if (printJob.printAcceptance !== null) {
      return NextResponse.json(
        { error: 'Print has already been accepted or rejected' },
        { status: 400 }
      );
    }

    // Update the print job
    const updatedPrint = await prisma.printQueue.update({
      where: { id },
      data: {
        printAcceptance,
        printNote: printNote || printJob.printNote,
        acceptedByUserId: session.user.id,
      },
      include: {
        geometryProcessingQueue: {
          include: {
            geometry: {
              select: {
                GeometryName: true,
                GeometryAlgorithmName: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json(updatedPrint);
  } catch (error) {
    console.error('Error updating print acceptance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
