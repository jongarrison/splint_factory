import { NextRequest, NextResponse } from 'next/server';
import { getCronAuthorizationFailure } from '@/lib/cron-auth';
import { evaluateProcessorOfflineState } from '@/lib/processor-offline-monitor';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authorizationFailure = getCronAuthorizationFailure(request);

  if (authorizationFailure === 'missing-secret') {
    console.error('[ProcessorOfflineCron] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Cron authentication is not configured' }, { status: 503 });
  }

  if (authorizationFailure === 'unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await evaluateProcessorOfflineState();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ProcessorOfflineCron] Evaluation failed:', error);
    return NextResponse.json({ error: 'Processor offline evaluation failed' }, { status: 500 });
  }
}
