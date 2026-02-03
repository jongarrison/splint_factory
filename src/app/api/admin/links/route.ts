import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/admin/links - List all links with stats
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.role || session.user.role !== 'SYSTEM_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const links = await prisma.link.findMany({
      include: {
        creator: {
          select: {
            name: true,
            email: true
          }
        },
        _count: {
          select: { activity: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ links });

  } catch (error) {
    console.error('Error fetching links:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/links - Create new link
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.role || session.user.role !== 'SYSTEM_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { shortcode, linkType, linkTarget, title } = body;

    // Validate inputs
    if (!shortcode || !linkType || !linkTarget) {
      return NextResponse.json({ 
        error: 'Missing required fields: shortcode, linkType, linkTarget' 
      }, { status: 400 });
    }

    // Check if shortcode already exists
    const existing = await prisma.link.findUnique({
      where: { shortcode }
    });

    if (existing) {
      return NextResponse.json({ 
        error: 'Shortcode already exists. Please choose a different one.' 
      }, { status: 409 });
    }

    // Validate link type
    if (!['EXTERNAL_URL', 'HOSTED_FILE'].includes(linkType)) {
      return NextResponse.json({ 
        error: 'Invalid linkType. Must be EXTERNAL_URL or HOSTED_FILE' 
      }, { status: 400 });
    }

    // Create the link
    const link = await prisma.link.create({
      data: {
        shortcode,
        linkType,
        linkTarget,
        title: title || null,
        createdBy: session.user.id
      },
      include: {
        creator: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json({ link }, { status: 201 });

  } catch (error) {
    console.error('Error creating link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
