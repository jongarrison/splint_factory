import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/organizations/[id]/print-stats
// Returns per-design print counts with accepted/rejected breakdown
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (user?.role !== 'SYSTEM_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - SYSTEM_ADMIN access required' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verify org exists
    const org = await prisma.organization.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Fetch all designs that have prints for this org, with their print records
    const designs = await prisma.namedGeometry.findMany({
      where: {
        geometryJobs: {
          some: {
            OwningOrganizationID: id,
            printQueue: { some: {} },
          },
        },
      },
      select: {
        id: true,
        GeometryName: true,
        geometryJobs: {
          where: {
            OwningOrganizationID: id,
            printQueue: { some: {} },
          },
          select: {
            printQueue: {
              select: {
                printAcceptance: true,
              },
            },
          },
        },
      },
      orderBy: { GeometryName: 'asc' },
    });

    // Aggregate counts per design
    const stats = designs.map((design) => {
      let printCount = 0;
      let acceptedCount = 0;
      let rejectedCount = 0;

      for (const job of design.geometryJobs) {
        for (const pq of job.printQueue) {
          printCount++;
          if (pq.printAcceptance === true) acceptedCount++;
          else if (pq.printAcceptance === false) rejectedCount++;
        }
      }

      return {
        designName: design.GeometryName,
        printCount,
        acceptedCount,
        rejectedCount,
      };
    });

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching org print stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
