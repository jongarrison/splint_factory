import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { logAuditEvent } from '@/lib/audit';
import {
  clearProcessorOfflineState,
  getOrCreateProcessorHeartbeat,
  getProcessorOfflineReminderIntervalMs,
  getProcessorOfflineThresholdMs,
  setProcessorOfflineAlertSent,
  setProcessorOfflineState,
} from '@/lib/geo-processor-health';
import { registerInternalTask } from '@/lib/internal-task-scheduler';
import ProcessorOfflineAlertEmail from '@/emails/processor-offline-alert';

const PROCESSOR_OFFLINE_MONITOR_TASK_KEY = 'processor-offline-monitor';
const DEFAULT_MONITOR_INTERVAL_MS = 60_000;

function getMonitorIntervalMs(): number {
  const rawValue = process.env.PROCESSOR_OFFLINE_MONITOR_INTERVAL_MS;
  const parsed = rawValue ? Number(rawValue) : NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MONITOR_INTERVAL_MS;
  }

  return Math.floor(parsed);
}

function buildAdminUrl(): string {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${baseUrl.replace(/\/$/, '')}/admin`;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

async function evaluateProcessorOfflineState(): Promise<void> {
  const heartbeat = await getOrCreateProcessorHeartbeat();
  const thresholdMs = getProcessorOfflineThresholdMs();
  const reminderIntervalMs = getProcessorOfflineReminderIntervalMs();
  const now = new Date();

  if (!heartbeat.lastPingAt) {
    return;
  }

  const msSinceLastPing = now.getTime() - heartbeat.lastPingAt.getTime();
  const isOffline = msSinceLastPing >= thresholdMs;

  if (!isOffline) {
    if (heartbeat.offlineSince || heartbeat.lastOfflineAlertSentAt) {
      await clearProcessorOfflineState();
      logAuditEvent({
        eventType: 'PROCESSOR_OFFLINE_RECOVERED',
        channel: 'SYSTEM',
        metadata: {
          recoveredAt: now.toISOString(),
          lastPingAt: heartbeat.lastPingAt.toISOString(),
        },
      });
    }
    return;
  }

  const offlineSince = heartbeat.offlineSince ?? now;
  const isInitialOfflineAlert = !heartbeat.lastOfflineAlertSentAt;

  if (!heartbeat.offlineSince) {
    await setProcessorOfflineState(offlineSince);
  }

  const shouldSendReminder = Boolean(
    heartbeat.lastOfflineAlertSentAt
      && now.getTime() - heartbeat.lastOfflineAlertSentAt.getTime() >= reminderIntervalMs,
  );

  if (!isInitialOfflineAlert && !shouldSendReminder) {
    return;
  }

  const recipients = await prisma.user.findMany({
    where: {
      role: 'SYSTEM_ADMIN',
      siteAlertOptIn: true,
    },
    select: {
      email: true,
      id: true,
    },
  });

  const recipientEmails = recipients.map((recipient) => recipient.email).filter(Boolean);
  const isReminder = !isInitialOfflineAlert;

  if (recipientEmails.length === 0) {
    await setProcessorOfflineAlertSent(now);
    logAuditEvent({
      eventType: 'PROCESSOR_OFFLINE_ALERT_SKIPPED_NO_RECIPIENTS',
      channel: 'SYSTEM',
      metadata: {
        at: now.toISOString(),
        offlineSince: offlineSince.toISOString(),
        lastPingAt: heartbeat.lastPingAt.toISOString(),
      },
    });
    return;
  }

  await sendEmail({
    to: recipientEmails,
    subject: isReminder ? 'Reminder: Design Processor still offline' : 'Design Processor Offline',
    react: ProcessorOfflineAlertEmail({
      isReminder,
      lastPingTime: heartbeat.lastPingAt.toISOString(),
      offlineDuration: formatDuration(now.getTime() - offlineSince.getTime()),
      adminUrl: buildAdminUrl(),
      thresholdSeconds: Math.floor(thresholdMs / 1000),
      reminderMinutes: Math.floor(reminderIntervalMs / 60_000),
    }),
  });

  await setProcessorOfflineAlertSent(now);
  logAuditEvent({
    eventType: isReminder ? 'PROCESSOR_OFFLINE_REMINDER_SENT' : 'PROCESSOR_OFFLINE_ALERT_SENT',
    channel: 'SYSTEM',
    metadata: {
      at: now.toISOString(),
      recipientCount: recipientEmails.length,
      offlineSince: offlineSince.toISOString(),
      lastPingAt: heartbeat.lastPingAt.toISOString(),
      secondsSinceLastPing: Math.floor(msSinceLastPing / 1000),
    },
  });
}

export function registerProcessorOfflineMonitorTask(): void {
  registerInternalTask({
    key: PROCESSOR_OFFLINE_MONITOR_TASK_KEY,
    label: 'Processor Offline Monitor',
    description: 'Evaluates processor heartbeat and sends transition/reminder alerts.',
    intervalMs: getMonitorIntervalMs(),
    runOnStartup: true,
    task: evaluateProcessorOfflineState,
  });
}
