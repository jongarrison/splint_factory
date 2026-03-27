import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getProcessorStatus } from '@/lib/geo-processor-health';
import { generateObjectID } from '@/lib/objectId';

// GET /api/admin/system-status - View system status including geometry processing queue (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.role || session.user.role !== 'SYSTEM_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 401 });
    }

    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // Get jobs in various states
    const [
      neverStarted, 
      stuckJobs, 
      recentlyCompleted, 
      processing, 
      failedLast24h, 
      successLast24h,
      completedLast24h,
      completedPrevious24h,
      jobsByAlgorithm,
      recentErrors
    ] = await Promise.all([
      // Never started
      prisma.geometryProcessingQueue.findMany({
        where: {
          ProcessStartedTime: null,
          ProcessCompletedTime: null,
          isEnabled: true
        },
        select: {
          id: true,
          CreationTime: true,
          geometry: { select: { GeometryName: true } },
          objectID: true,
          isDebugRequest: true
        },
        orderBy: { CreationTime: 'asc' },
        take: 10
      }),
      
      // Started but stuck (>10 min, not completed)
      prisma.geometryProcessingQueue.findMany({
        where: {
          ProcessStartedTime: { lt: tenMinutesAgo },
          ProcessCompletedTime: null,
          isEnabled: true
        },
        select: {
          id: true,
          CreationTime: true,
          ProcessStartedTime: true,
          geometry: { select: { GeometryName: true } },
          objectID: true,
          isDebugRequest: true
        },
        orderBy: { CreationTime: 'asc' },
        take: 10
      }),
      
      // Recently completed (last hour)
      prisma.geometryProcessingQueue.findMany({
        where: {
          ProcessCompletedTime: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
          isEnabled: true
        },
        select: {
          id: true,
          CreationTime: true,
          ProcessStartedTime: true,
          ProcessCompletedTime: true,
          isProcessSuccessful: true,
          geometry: { select: { GeometryName: true } },
          objectID: true,
          isDebugRequest: true
        },
        orderBy: { ProcessCompletedTime: 'desc' },
        take: 10
      }),
      
      // Currently processing (started in last 10 min, not completed)
      prisma.geometryProcessingQueue.findMany({
        where: {
          ProcessStartedTime: { gte: tenMinutesAgo },
          ProcessCompletedTime: null,
          isEnabled: true
        },
        select: {
          id: true,
          CreationTime: true,
          ProcessStartedTime: true,
          geometry: { select: { GeometryName: true } },
          objectID: true,
          isDebugRequest: true
        },
        orderBy: { ProcessStartedTime: 'desc' },
        take: 10
      }),
      
      // Failed jobs in last 24 hours (exclude test jobs)
      prisma.geometryProcessingQueue.count({
        where: {
          ProcessCompletedTime: { gte: oneDayAgo },
          isProcessSuccessful: false,
          isEnabled: true,
          isDebugRequest: false
        }
      }),
      
      // Successful jobs in last 24 hours (exclude test jobs)
      prisma.geometryProcessingQueue.count({
        where: {
          ProcessCompletedTime: { gte: oneDayAgo },
          isProcessSuccessful: true,
          isEnabled: true,
          isDebugRequest: false
        }
      }),
      
      // Completed jobs last 24h with timing data (exclude test jobs)
      prisma.geometryProcessingQueue.findMany({
        where: {
          ProcessCompletedTime: { gte: oneDayAgo },
          ProcessStartedTime: { not: null },
          isEnabled: true,
          isDebugRequest: false
        },
        select: {
          ProcessStartedTime: true,
          ProcessCompletedTime: true,
          isProcessSuccessful: true
        }
      }),
      
      // Completed jobs 24-48h ago with timing data (exclude test jobs)
      prisma.geometryProcessingQueue.findMany({
        where: {
          ProcessCompletedTime: { gte: twoDaysAgo, lt: oneDayAgo },
          ProcessStartedTime: { not: null },
          isEnabled: true,
          isDebugRequest: false
        },
        select: {
          ProcessStartedTime: true,
          ProcessCompletedTime: true
        }
      }),
      
      // Jobs by algorithm (last 7 days, exclude test jobs)
      prisma.geometryProcessingQueue.groupBy({
        by: ['GeometryID'],
        where: {
          ProcessCompletedTime: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
          isEnabled: true,
          isDebugRequest: false
        },
        _count: {
          id: true
        }
      }),
      
      // Recent failed jobs with error messages (exclude test jobs)
      prisma.geometryProcessingQueue.findMany({
        where: {
          ProcessCompletedTime: { gte: oneDayAgo },
          isProcessSuccessful: false,
          isEnabled: true,
          isDebugRequest: false
        },
        select: {
          id: true,
          ProcessingLog: true,
          geometry: {
            select: {
              GeometryName: true,
              GeometryAlgorithmName: true
            }
          }
        },
        take: 50
      })
    ]);
    
    // Get geometry names for algorithm stats
    const geometryIds = jobsByAlgorithm.map(j => j.GeometryID);
    const geometries = geometryIds.length > 0 ? await prisma.namedGeometry.findMany({
      where: { id: { in: geometryIds } },
      select: { id: true, GeometryName: true, GeometryAlgorithmName: true }
    }) : [];
    
    const geometryMap = new Map(geometries.map(g => [g.id, g]));
    
    // Calculate average processing times
    const calcAvgProcessingTime = (jobs: any[]) => {
      if (jobs.length === 0) return null;
      const times = jobs
        .filter(j => j.ProcessStartedTime && j.ProcessCompletedTime)
        .map(j => new Date(j.ProcessCompletedTime!).getTime() - new Date(j.ProcessStartedTime!).getTime());
      return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : null;
    };
    
    const avgProcessingTimeLast24h = calcAvgProcessingTime(completedLast24h);
    const avgProcessingTimePrevious24h = calcAvgProcessingTime(completedPrevious24h);
    
    // Calculate processing time trend
    let processingTimeTrend: 'faster' | 'slower' | 'stable' | null = null;
    if (avgProcessingTimeLast24h && avgProcessingTimePrevious24h) {
      const diff = ((avgProcessingTimeLast24h - avgProcessingTimePrevious24h) / avgProcessingTimePrevious24h) * 100;
      if (Math.abs(diff) < 5) processingTimeTrend = 'stable';
      else if (diff < 0) processingTimeTrend = 'faster';
      else processingTimeTrend = 'slower';
    }
    
    // Calculate hourly throughput (last 24 hours)
    const hourlyBuckets = new Map<number, number>();
    completedLast24h.forEach(job => {
      if (job.ProcessCompletedTime) {
        const hour = Math.floor((now.getTime() - new Date(job.ProcessCompletedTime).getTime()) / (60 * 60 * 1000));
        hourlyBuckets.set(hour, (hourlyBuckets.get(hour) || 0) + 1);
      }
    });
    
    const throughputPerHour = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: hourlyBuckets.get(i) || 0
    })).reverse();
    
    // Parse error messages and categorize
    const errorBreakdown = new Map<string, number>();
    recentErrors.forEach(job => {
      if (job.ProcessingLog) {
        // Extract error type from log
        if (job.ProcessingLog.includes('mesh export failed')) {
          errorBreakdown.set('Mesh Export Failed', (errorBreakdown.get('Mesh Export Failed') || 0) + 1);
        } else if (job.ProcessingLog.includes('timeout')) {
          errorBreakdown.set('Timeout', (errorBreakdown.get('Timeout') || 0) + 1);
        } else if (job.ProcessingLog.includes('ECONNREFUSED') || job.ProcessingLog.includes('ETIMEDOUT')) {
          errorBreakdown.set('Network Error', (errorBreakdown.get('Network Error') || 0) + 1);
        } else if (job.ProcessingLog.includes('Exception') || job.ProcessingLog.includes('Error')) {
          errorBreakdown.set('Processing Error', (errorBreakdown.get('Processing Error') || 0) + 1);
        } else {
          errorBreakdown.set('Other', (errorBreakdown.get('Other') || 0) + 1);
        }
      } else {
        errorBreakdown.set('Unknown', (errorBreakdown.get('Unknown') || 0) + 1);
      }
    });
    
    // Jobs by algorithm
    const algorithmStats = jobsByAlgorithm.map(item => {
      const geom = geometryMap.get(item.GeometryID);
      return {
        algorithm: geom?.GeometryAlgorithmName || 'Unknown',
        name: geom?.GeometryName || 'Unknown',
        count: item._count.id
      };
    }).sort((a, b) => b.count - a.count);

    const processorStatus = getProcessorStatus();

    // Get maintenance mode settings
    const maintenanceSettings = await prisma.systemSettings.findUnique({
      where: { id: 'system_settings' },
      select: {
        maintenanceModeEnabled: true,
        maintenanceMessage: true
      }
    });

    return NextResponse.json({
      timestamp: now.toISOString(),
      processor: {
        isHealthy: processorStatus.isHealthy,
        secondsSinceLastPing: processorStatus.secondsSinceLastPing,
        lastPingTime: processorStatus.lastPingTime
      },
      summary: {
        neverStartedCount: neverStarted.length,
        stuckJobsCount: stuckJobs.length,
        processingCount: processing.length,
        recentlyCompletedCount: recentlyCompleted.length,
        failedLast24h,
        successLast24h,
        successRate24h: successLast24h + failedLast24h > 0 
          ? Math.round((successLast24h / (successLast24h + failedLast24h)) * 100) 
          : null
      },
      metrics: {
        avgProcessingTimeMs: avgProcessingTimeLast24h ? Math.round(avgProcessingTimeLast24h) : null,
        avgProcessingTimeSec: avgProcessingTimeLast24h ? Math.round(avgProcessingTimeLast24h / 1000) : null,
        processingTimeTrend,
        processingTimeTrendPercent: avgProcessingTimeLast24h && avgProcessingTimePrevious24h 
          ? Math.round(((avgProcessingTimeLast24h - avgProcessingTimePrevious24h) / avgProcessingTimePrevious24h) * 100)
          : null,
        throughputPerHour,
        avgThroughputPerHour: throughputPerHour.length > 0 
          ? Math.round(throughputPerHour.reduce((sum, h) => sum + h.count, 0) / throughputPerHour.length)
          : 0,
        errorBreakdown: Array.from(errorBreakdown.entries()).map(([type, count]) => ({ type, count })),
        algorithmStats,
        queueDepthTrend: {
          current: neverStarted.length + stuckJobs.length + processing.length,
          description: 'Current queue depth (pending + stuck + processing)'
        }
      },
      queues: {
        neverStarted,
        stuckJobs,
        processing,
        recentlyCompleted
      },
      maintenance: {
        maintenanceModeEnabled: maintenanceSettings?.maintenanceModeEnabled || false,
        maintenanceMessage: maintenanceSettings?.maintenanceMessage || null
      }
    });

  } catch (error) {
    console.error('Error getting queue status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/system-status - Update system settings (admin only)
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.role || session.user.role !== 'SYSTEM_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 401 });
    }

    const body = await request.json();
    const { maintenanceModeEnabled, maintenanceMessage } = body;

    // Upsert maintenance settings
    const updated = await prisma.systemSettings.upsert({
      where: { id: 'system_settings' },
      update: {
        maintenanceModeEnabled,
        maintenanceMessage,
        maintenanceModeUpdatedAt: new Date()
      },
      create: {
        id: 'system_settings',
        maintenanceModeEnabled,
        maintenanceMessage
      }
    });

    return NextResponse.json({
      success: true,
      maintenance: {
        maintenanceModeEnabled: updated.maintenanceModeEnabled,
        maintenanceMessage: updated.maintenanceMessage
      }
    });

  } catch (error) {
    console.error('Error updating system settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/system-status - Create a processor health check job (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.role || session.user.role !== 'SYSTEM_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true }
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'Admin user must be part of an organization' }, { status: 403 });
    }

    // Always associate health check jobs with "System Administration" org
    const systemOrg = await prisma.organization.findUnique({
      where: { name: 'System Administration' }
    });

    if (!systemOrg) {
      return NextResponse.json({ error: '"System Administration" organization not found. Run the seed script.' }, { status: 404 });
    }

    // Find the cylinder test geometry
    const cylinderGeometry = await prisma.namedGeometry.findFirst({
      where: { GeometryAlgorithmName: 'cylinder' }
    });

    if (!cylinderGeometry) {
      return NextResponse.json(
        { error: 'Cylinder test geometry not found. Create a NamedGeometry with GeometryAlgorithmName "cylinder" first.' },
        { status: 404 }
      );
    }

    const objectID = await generateObjectID();

    const job = await prisma.geometryProcessingQueue.create({
      data: {
        GeometryID: cylinderGeometry.id,
        CreatorID: session.user.id,
        OwningOrganizationID: systemOrg.id,
        GeometryInputParameterData: JSON.stringify({ radius: 10, height: 10 }),
        isDebugRequest: true,
        JobNote: 'Processor health check',
        objectID,
        objectIDGeneratedAt: new Date(),
        isEnabled: true
      },
      select: {
        id: true,
        objectID: true,
        CreationTime: true
      }
    });

    return NextResponse.json(job, { status: 201 });

  } catch (error) {
    console.error('Error creating health check job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
