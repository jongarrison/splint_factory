import { prisma } from '@/lib/prisma';

interface AuditEventParams {
  eventType: string;
  channel: string;
  actorId?: string | null;
  targetUserId?: string | null;
  organizationId?: string | null;
  metadata?: Record<string, unknown> | null;
}

// Fire-and-forget audit logger. Catches errors internally so callers
// never have to worry about logging failures breaking their flow.
export function logAuditEvent(params: AuditEventParams): void {
  prisma.auditEvent
    .create({
      data: {
        eventType: params.eventType,
        channel: params.channel,
        actorId: params.actorId ?? undefined,
        targetUserId: params.targetUserId ?? undefined,
        organizationId: params.organizationId ?? undefined,
        metadata: params.metadata ?? undefined,
      },
    })
    .catch((err) => {
      console.error('[Audit] Failed to log event:', params.eventType, err);
    });
}
