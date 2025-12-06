import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateApiKey, checkApiPermission } from '@/lib/api-auth';
import { getBlobStorageInstance } from '@/lib/blob-storage';

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

    // Handle both multipart (new blob storage) and JSON (legacy) formats
    const contentType = request.headers.get('content-type') || '';
    let GeometryProcessingQueueID: string;
    let isSuccess: boolean;
    let errorMessage: string | undefined;
    let processingLog: string | undefined;
    let GeometryFileContents: string | undefined;
    let GeometryFileName: string | undefined;
    let PrintFileContents: string | undefined;
    let PrintFileName: string | undefined;
    let geometryFile: File | undefined;
    let printFile: File | undefined;

    if (contentType.includes('multipart/form-data')) {
      // New format: multipart with actual files
      const formData = await request.formData();
      GeometryProcessingQueueID = formData.get('GeometryProcessingQueueID') as string;
      isSuccess = formData.get('isSuccess') === 'true';
      errorMessage = formData.get('errorMessage') as string | undefined;
      processingLog = formData.get('processingLog') as string | undefined;
      geometryFile = formData.get('geometryFile') as File | undefined;
      printFile = formData.get('printFile') as File | undefined;
      GeometryFileName = geometryFile?.name;
      PrintFileName = printFile?.name;
    } else {
      // Legacy format: JSON with base64
      const body = await request.json();
      GeometryProcessingQueueID = body.GeometryProcessingQueueID;
      isSuccess = body.isSuccess;
      errorMessage = body.errorMessage;
      processingLog = body.processingLog;
      GeometryFileContents = body.GeometryFileContents;
      GeometryFileName = body.GeometryFileName;
      PrintFileContents = body.PrintFileContents;
      PrintFileName = body.PrintFileName;
    }

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

    // Validate file size limits (500MB for blob storage, 10MB for legacy base64)
    const maxFileSize = 500 * 1024 * 1024; // 500MB for blob storage
    const maxLegacyFileSize = 10 * 1024 * 1024; // 10MB for base64 (legacy)
    const maxFileNameLen = 255;
    const invalidName = /[\\/]/; // prevent path traversal
    
    // Validate multipart files
    if (geometryFile) {
      if (geometryFile.size > maxFileSize) {
        return NextResponse.json({ 
          error: 'Geometry file exceeds 500MB limit' 
        }, { status: 400 });
      }
    }
    
    if (printFile) {
      if (printFile.size > maxFileSize) {
        return NextResponse.json({ 
          error: 'Print file exceeds 500MB limit' 
        }, { status: 400 });
      }
    }
    
    // Validate legacy base64 files
    if (GeometryFileContents) {
      try {
        const geometryBuffer = Buffer.from(GeometryFileContents, 'base64');
        if (geometryBuffer.length > maxLegacyFileSize) {
          return NextResponse.json({ 
            error: 'Geometry file exceeds 10MB limit (use multipart upload for larger files)' 
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
        if (printBuffer.length > maxLegacyFileSize) {
          return NextResponse.json({ 
            error: 'Print file exceeds 10MB limit (use multipart upload for larger files)' 
          }, { status: 400 });
        }
      } catch (e) {
        return NextResponse.json({ 
          error: 'Invalid base64 encoding for print file' 
        }, { status: 400 });
      }
    }

    // Validate filenames (length and path traversal chars)
    if (GeometryFileName && (GeometryFileName.length > maxFileNameLen || invalidName.test(GeometryFileName))) {
      return NextResponse.json({ error: 'Invalid GeometryFileName' }, { status: 400 });
    }
    if (PrintFileName && (PrintFileName.length > maxFileNameLen || invalidName.test(PrintFileName))) {
      return NextResponse.json({ error: 'Invalid PrintFileName' }, { status: 400 });
    }

    // Validate processingLog size (limit to 100KB)
    const maxLogSize = 100 * 1024; // 100KB
    if (processingLog && typeof processingLog === 'string' && processingLog.length > maxLogSize) {
      return NextResponse.json({ error: 'Processing log exceeds 100KB limit' }, { status: 400 });
    }

    const currentTime = new Date();

    // Upload files to blob storage if provided
    const blobStorage = getBlobStorageInstance();
    let geometryBlobResult;
    let printBlobResult;

    if (geometryFile) {
      const geometryBuffer = Buffer.from(await geometryFile.arrayBuffer());
      geometryBlobResult = await blobStorage.upload(geometryBuffer, geometryFile.name);
      console.log(`Uploaded geometry file to blob storage: ${geometryBlobResult.pathname} (${geometryBlobResult.size} bytes)`);
    }

    if (printFile) {
      const printBuffer = Buffer.from(await printFile.arrayBuffer());
      printBlobResult = await blobStorage.upload(printBuffer, printFile.name);
      console.log(`Uploaded print file to blob storage: ${printBlobResult.pathname} (${printBlobResult.size} bytes)`);
    }

    // Start transaction to update geometry processing queue and create print queue entry if successful
    const result = await prisma.$transaction(async (tx) => {
      // Prepare update data
      const updateData: any = {
        ProcessCompletedTime: currentTime,
        isProcessSuccessful: isSuccess,
        ProcessingLog: processingLog ?? undefined,
      };

      // Handle blob storage (new format)
      if (geometryBlobResult) {
        updateData.GeometryBlobUrl = geometryBlobResult.url;
        updateData.GeometryBlobPathname = geometryBlobResult.pathname;
        updateData.GeometryFileName = GeometryFileName;
      }
      if (printBlobResult) {
        updateData.PrintBlobUrl = printBlobResult.url;
        updateData.PrintBlobPathname = printBlobResult.pathname;
        updateData.PrintFileName = PrintFileName;
      }

      // Handle legacy base64 format (fallback)
      if (GeometryFileContents && !geometryBlobResult) {
        updateData.GeometryFileContents = Buffer.from(GeometryFileContents, 'base64');
        updateData.GeometryFileName = GeometryFileName;
      }
      if (PrintFileContents && !printBlobResult) {
        updateData.PrintFileContents = Buffer.from(PrintFileContents, 'base64');
        updateData.PrintFileName = PrintFileName;
      }

      // Update the geometry processing queue entry
      const updatedGeometryJob = await tx.geometryProcessingQueue.update({
        where: { id: GeometryProcessingQueueID },
        data: updateData,
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

      // If processing was successful, create print queue entry referencing this job
      if (isSuccess) {
        printQueueEntry = await tx.printQueue.create({
          data: {
            GeometryProcessingQueueID
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
        hasGeometryFile: !!(geometryFile || GeometryFileContents),
        hasPrintFile: !!(printFile || PrintFileContents),
        GeometryFileName: GeometryFileName || null,
        PrintFileName: PrintFileName || null,
        usedBlobStorage: !!(geometryBlobResult || printBlobResult)
      };
    }

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Error recording geometry processing result:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}