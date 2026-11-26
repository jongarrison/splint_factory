import { NextRequest, NextResponse } from 'next/server';
import { getCronAuthorizationFailure } from '@/lib/cron-auth';
import { archiveCompletedPrintJobs } from '@/lib/print-auto-archive-task';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authorizationFailure = getCronAuthorizationFailure(request);

  if (authorizationFailure === 'missing-secret') {
    console.error('[PrintAutoArchiveCron] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'Cron authentication is not configured' }, { status: 503 });
  }

  if (authorizationFailure === 'unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return NextResponse.json(await archiveCompletedPrintJobs());
  } catch (error) {
    console.error('[PrintAutoArchiveCron] Archival failed:', error);
    return NextResponse.json({ error: 'Print auto-archive failed' }, { status: 500 });
  }
}
