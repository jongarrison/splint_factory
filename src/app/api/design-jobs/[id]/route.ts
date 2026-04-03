import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/design-jobs/[id] - Get specific geometry processing job
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get user with organization
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        organizationId: true,
        role: true 
      }
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'User must be part of an organization' }, { status: 403 });
    }

    const geometryJob = await prisma.designJob.findUnique({
      where: { id },
      include: {
        design: {
          select: {
            name: true,
            algorithmName: true,
            inputParameterSchema: true
          }
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        owningOrganization: {
          select: {
            name: true
          }
        }
      }
    });

    if (!geometryJob) {
      return NextResponse.json({ error: 'Geometry job not found' }, { status: 404 });
    }

    // Verify user has access to this job (same organization)
    if (geometryJob.owningOrganizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json(geometryJob);
  } catch (error) {
    console.error('Error fetching geometry job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/design-jobs/[id] - Disable geometry processing job (following additive approach)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get user with organization
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        organizationId: true,
        role: true 
      }
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'User must be part of an organization' }, { status: 403 });
    }

    // Check if job exists and user has access
    const existingJob = await prisma.designJob.findUnique({
      where: { id },
      select: {
        owningOrganizationId: true
      }
    });

    if (!existingJob) {
      return NextResponse.json({ error: 'Geometry job not found' }, { status: 404 });
    }

    if (existingJob.owningOrganizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Disable the job instead of deleting (following additive approach)
    const updatedJob = await prisma.designJob.update({
      where: { id },
      data: {
        isEnabled: false
      },
      select: {
        id: true,
        isEnabled: true
      }
    });

    console.log(`Disabled geometry processing job ${id} by user ${session.user.id}`);
    return NextResponse.json({ 
      message: 'Geometry processing job disabled successfully',
      job: updatedJob
    });

  } catch (error) {
    console.error('Error disabling geometry job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}