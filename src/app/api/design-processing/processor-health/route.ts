import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getProcessorStatus } from '@/lib/geo-processor-health';
import { ensureInternalTaskRuntimeStarted } from '@/lib/internal-task-runtime';

// GET /api/design-processing/processor-health - Check if geometry processor is actively polling
export async function GET() {
  try {
    ensureInternalTaskRuntimeStarted();

    const session = await auth();
    
    // Only allow SYSTEM_ADMIN to check processor health
    if (session?.user?.role !== 'SYSTEM_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = await getProcessorStatus();
    
    return NextResponse.json(status);
  } catch (error) {
    console.error('Error checking processor health:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
