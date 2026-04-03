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
    const designs = await prisma.design.findMany({
      where: {
        designJobs: {
          some: {
            owningOrganizationId: id,
            printJobs: { some: {} },
          },
        },
      },
      select: {
        id: true,
        name: true,
        designJobs: {
          where: {
            owningOrganizationId: id,
            printJobs: { some: {} },
          },
          select: {
            printJobs: {
              select: {
                printAcceptance: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Aggregate counts per design
    const stats = designs.map((design) => {
      let printCount = 0;
      let acceptedCount = 0;
      let rejectDesignCount = 0;
      let rejectPrintCount = 0;
      let rejectedLegacyCount = 0;

      for (const job of design.designJobs) {
        for (const pq of job.printJobs) {
          printCount++;
          if (pq.printAcceptance === 'ACCEPTED') {
            acceptedCount++;
          } else if (pq.printAcceptance === 'REJECT_DESIGN') {
            rejectDesignCount++;
          } else if (pq.printAcceptance === 'REJECT_PRINT') {
            rejectPrintCount++;
          } else if (pq.printAcceptance === 'REJECTED') {
            rejectedLegacyCount++;
          }
        }
      }

      return {
        designName: design.name,
        printCount,
        acceptedCount,
        rejectDesignCount,
        rejectPrintCount,
        rejectedLegacyCount,
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
