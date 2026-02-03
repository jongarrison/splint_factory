import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/links/{id}/activity - Get activity log for a link
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.role || session.user.role !== 'SYSTEM_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get link details
    const link = await prisma.link.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    if (!link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    // Get activity log
    const activity = await prisma.linkActivity.findMany({
      where: { linkId: id },
      orderBy: { visitTime: 'desc' },
      take: 100 // Limit to last 100 visits
    });

    return NextResponse.json({ link, activity });

  } catch (error) {
    console.error('Error fetching link activity:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
