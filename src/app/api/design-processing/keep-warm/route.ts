import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  extendProcessorWarmLease,
  PROCESSOR_KEEP_WARM_LEASE_MS,
} from '@/lib/geo-processor-health';

// POST /api/design-processing/keep-warm
// Called by the /design-jobs/new client page on mount to extend the geo
// processor's Rhino keep-warm lease. Session auth only -- no body, fire-and-
// forget from the client. Idempotent: extends warmUntil to max(current, now+lease).
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const warmUntil = await extendProcessorWarmLease(PROCESSOR_KEEP_WARM_LEASE_MS);
    console.log(
      `[keep-warm] user=${session.user.id} extended lease; warmUntil=${warmUntil.toISOString()}`,
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[keep-warm] failed to extend lease:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
