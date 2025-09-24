import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateApiKey, checkApiPermission } from '@/lib/api-auth';

// POST /api/geometry-processing/result - Report geometry processing result from external software
export async function POST(request: NextRequest) {
  try {
    // Try API key authentication first
    const apiAuth = await validateApiKey(request);
    
    if (apiAuth.success) {
      // Validate API key has required permission
      if (!checkApiPermission(apiAuth.apiKey, 'geometry-queue:write')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
      console.log(`API key access: ${apiAuth.apiKey?.name} reporting processing result`);
    } else {
      // Fall back to session authentication
      const session = await auth();
      
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json();
    const {
      GeometryProcessingQueueID,
      isSuccess,
      errorMessage,
      GeometryFileContents, // Base64 encoded 3MF file
      GeometryFileName,
      PrintFileContents,    // Base64 encoded gcode file  
      PrintFileName
    } = body;

    // Validate required fields
    if (!GeometryProcessingQueueID || isSuccess === undefined) {
      return NextResponse.json({ 
        error: 'GeometryProcessingQueueID and isSuccess are required' 
      }, { status: 400 });
    }

    // Validate that geometry processing queue entry exists
    const geometryJob = await prisma.geometryProcessingQueue.findUnique({
      where: { id: GeometryProcessingQueueID },
      select: {
        id: true,
        ProcessStartedTime: true,
        isProcessSuccessful: true
      }
    });

    if (!geometryJob) {
      return NextResponse.json({ 
        error: 'Geometry processing queue entry not found' 
      }, { status: 404 });
    }

    // Validate that the job was actually started (has ProcessStartedTime)
    if (!geometryJob.ProcessStartedTime) {
      return NextResponse.json({ 
        error: 'Job has not been started yet' 
      }, { status: 400 });
    }

    // Validate file size limits (10MB as specified in requirements)
    const maxFileSize = 10 * 1024 * 1024; // 10MB in bytes
    
    if (GeometryFileContents) {
      try {
        const geometryBuffer = Buffer.from(GeometryFileContents, 'base64');
        if (geometryBuffer.length > maxFileSize) {
          return NextResponse.json({ 
            error: 'Geometry file exceeds 10MB limit' 
          }, { status: 400 });
        }
      } catch (e) {
        return NextResponse.json({ 
          error: 'Invalid base64 encoding for geometry file' 
        }, { status: 400 });
      }
    }
    
    if (PrintFileContents) {
      try {
        const printBuffer = Buffer.from(PrintFileContents, 'base64');
        if (printBuffer.length > maxFileSize) {
          return NextResponse.json({ 
            error: 'Print file exceeds 10MB limit' 
          }, { status: 400 });
        }
      } catch (e) {
        return NextResponse.json({ 
          error: 'Invalid base64 encoding for print file' 
        }, { status: 400 });
      }
    }

    const currentTime = new Date();

    // Start transaction to update geometry processing queue and create print queue entry if successful
    const result = await prisma.$transaction(async (tx) => {
      // Update the geometry processing queue entry
      const updatedGeometryJob = await tx.geometryProcessingQueue.update({
        where: { id: GeometryProcessingQueueID },
        data: {
          ProcessCompletedTime: currentTime,
          isProcessSuccessful: isSuccess
        },
        include: {
          geometry: {
            select: {
              GeometryName: true,
              GeometryAlgorithmName: true
            }
          }
        }
      });

      let printQueueEntry = null;

      // If processing was successful and files are provided, create print queue entry
      if (isSuccess && (GeometryFileContents || PrintFileContents)) {
        printQueueEntry = await tx.printQueue.create({
          data: {
            GeometryProcessingQueueID,
            GeometryFileContents: GeometryFileContents ? Buffer.from(GeometryFileContents, 'base64') : null,
            GeometryFileName: GeometryFileName || null,
            PrintFileContents: PrintFileContents ? Buffer.from(PrintFileContents, 'base64') : null,
            PrintFileName: PrintFileName || null
          }
        });
      }

      return { updatedGeometryJob, printQueueEntry };
    });

    const logMessage = result.updatedGeometryJob.isProcessSuccessful 
      ? `Successfully processed geometry job ${GeometryProcessingQueueID} (${result.updatedGeometryJob.geometry.GeometryName})`
      : `Failed to process geometry job ${GeometryProcessingQueueID} (${result.updatedGeometryJob.geometry.GeometryName}): ${errorMessage || 'No error message provided'}`;
    
    console.log(logMessage);
    
    // Log error message if processing failed
    if (!isSuccess && errorMessage) {
      console.error(`Geometry processing error for job ${GeometryProcessingQueueID}: ${errorMessage}`);
    }

    const response: any = {
      message: 'Processing result recorded successfully',
      geometryJob: {
        id: result.updatedGeometryJob.id,
        ProcessCompletedTime: result.updatedGeometryJob.ProcessCompletedTime,
        isProcessSuccessful: result.updatedGeometryJob.isProcessSuccessful
      }
    };

    if (result.printQueueEntry) {
      response.printQueueEntry = {
        id: result.printQueueEntry.id,
        hasGeometryFile: !!result.printQueueEntry.GeometryFileContents,
        hasPrintFile: !!result.printQueueEntry.PrintFileContents,
        GeometryFileName: result.printQueueEntry.GeometryFileName,
        PrintFileName: result.printQueueEntry.PrintFileName
      };
    }

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Error recording geometry processing result:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}