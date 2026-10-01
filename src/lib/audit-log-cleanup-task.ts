import { writeAuditEvent } from '@/lib/audit';
import { registerInternalTask } from '@/lib/internal-task-scheduler';
import { prisma } from '@/lib/prisma';

const TASK_KEY = 'audit-log-cleanup';
const RETENTION_MONTHS = 12;
const CLEANUP_EVENT_TYPE = 'AUDIT_LOG_CLEANUP_COMPLETED';

async function cleanupAuditLog(): Promise<void> {
  const startOfTodayUtc = new Date();
  startOfTodayUtc.setUTCHours(0, 0, 0, 0);

  const alreadyCompletedToday = await prisma.auditEvent.findFirst({
    where: {
      eventType: CLEANUP_EVENT_TYPE,
      timestamp: { gte: startOfTodayUtc },
    },
    select: { id: true },
  });

  if (alreadyCompletedToday) {
    return;
  }

  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - RETENTION_MONTHS);

  const result = await prisma.auditEvent.deleteMany({
    where: { timestamp: { lt: cutoff } },
  });

  await writeAuditEvent({
    eventType: CLEANUP_EVENT_TYPE,
    channel: 'SYSTEM',
    metadata: {
      retentionMonths: RETENTION_MONTHS,
      cutoff: cutoff.toISOString(),
      rowsRemoved: result.count,
    },
  });

  console.log(`[AuditCleanup] Removed ${result.count} audit event(s) older than ${cutoff.toISOString()}`);
}

export function registerAuditLogCleanupTask(): void {
  registerInternalTask({
    key: TASK_KEY,
    label: 'Audit Log Cleanup',
    description: `Deletes audit events older than ${RETENTION_MONTHS} months once per UTC day.`,
    intervalMs: 24 * 60 * 60 * 1000,
    runOnStartup: true,
    task: cleanupAuditLog,
  });
}