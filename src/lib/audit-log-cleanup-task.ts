import { writeAuditEvent } from '@/lib/audit';
import { registerInternalTask } from '@/lib/internal-task-scheduler';
import { prisma } from '@/lib/prisma';

const TASK_KEY = 'audit-log-cleanup';
const RETENTION_MONTHS = 12;
const CLEANUP_EVENT_TYPE = 'AUDIT_LOG_CLEANUP_COMPLETED';
const PERSISTENT_EVENT_TYPES = [
  'CLIENT_DEVICE_ORGANIZATION_CHANGED',
  'PRINTER_DEVICE_CHANGED',
  'PRINTER_ORGANIZATION_CHANGED',
];

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
    where: {
      timestamp: { lt: cutoff },
      eventType: { notIn: PERSISTENT_EVENT_TYPES },
    },
  });

  await writeAuditEvent({
    eventType: CLEANUP_EVENT_TYPE,
    channel: 'SYSTEM',
    metadata: {
      retentionMonths: RETENTION_MONTHS,
      cutoff: cutoff.toISOString(),
      rowsRemoved: result.count,
      persistentEventTypes: PERSISTENT_EVENT_TYPES,
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