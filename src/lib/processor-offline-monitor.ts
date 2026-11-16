import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { writeAuditEvent } from '@/lib/audit';
import {
  claimProcessorOfflineAlert,
  getOrCreateProcessorHeartbeat,
  getProcessorOfflineReminderIntervalMs,
  getProcessorOfflineThresholdMs,
  releaseProcessorOfflineAlertClaim,
} from '@/lib/geo-processor-health';
import {
  formatProcessorOfflineDuration,
  getProcessorOfflineAlertKind,
} from '@/lib/processor-offline-policy';
import ProcessorOfflineAlertEmail from '@/emails/processor-offline-alert';

function buildAdminUrl(): string {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${baseUrl.replace(/\/$/, '')}/admin`;
}

export interface ProcessorOfflineEvaluationResult {
  status: 'healthy' | 'not_due' | 'heartbeat_changed' | 'alert_sent' | 'reminder_sent' | 'no_recipients';
  lastPingAt: string | null;
}

/** Evaluates and conditionally claims one processor alert for the cron invocation. */
export async function evaluateProcessorOfflineState(): Promise<ProcessorOfflineEvaluationResult> {
  const thresholdMs = getProcessorOfflineThresholdMs();
  const reminderIntervalMs = getProcessorOfflineReminderIntervalMs();
  const now = new Date();
  let heartbeat = await getOrCreateProcessorHeartbeat();
  let alertKind = getProcessorOfflineAlertKind(heartbeat, now, thresholdMs, reminderIntervalMs);

  if (!heartbeat.lastPingAt) {
    return { status: 'healthy', lastPingAt: null };
  }

  if (!alertKind) {
    const isHealthy = now.getTime() - heartbeat.lastPingAt.getTime() < thresholdMs;
    return {
      status: isHealthy ? 'healthy' : 'not_due',
      lastPingAt: heartbeat.lastPingAt.toISOString(),
    };
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

  // Recipient lookup may take long enough for a new processor ping to arrive.
  heartbeat = await getOrCreateProcessorHeartbeat();
  alertKind = getProcessorOfflineAlertKind(heartbeat, now, thresholdMs, reminderIntervalMs);
  if (!heartbeat.lastPingAt || !alertKind) {
    return {
      status: 'heartbeat_changed',
      lastPingAt: heartbeat.lastPingAt?.toISOString() ?? null,
    };
  }

  const claim = {
    lastPingAt: heartbeat.lastPingAt,
    previousOfflineSince: heartbeat.offlineSince,
    previousAlertSentAt: heartbeat.lastOfflineAlertSentAt,
    claimedAt: now,
  };
  const claimed = await claimProcessorOfflineAlert(claim);
  if (!claimed) {
    return { status: 'heartbeat_changed', lastPingAt: heartbeat.lastPingAt.toISOString() };
  }

  // A processor ping clears the claim; verify once more immediately before email delivery.
  const claimedHeartbeat = await getOrCreateProcessorHeartbeat();
  if (
    claimedHeartbeat.lastPingAt?.getTime() !== heartbeat.lastPingAt.getTime()
    || claimedHeartbeat.lastOfflineAlertSentAt?.getTime() !== now.getTime()
  ) {
    return {
      status: 'heartbeat_changed',
      lastPingAt: claimedHeartbeat.lastPingAt?.toISOString() ?? null,
    };
  }

  const recipientEmails = recipients.map((recipient) => recipient.email).filter(Boolean);
  const isReminder = alertKind === 'reminder';
  const offlineSince = heartbeat.offlineSince ?? heartbeat.lastPingAt;
  const msSinceLastPing = now.getTime() - heartbeat.lastPingAt.getTime();

  if (recipientEmails.length === 0) {
    await writeAuditEvent({
      eventType: 'PROCESSOR_OFFLINE_ALERT_SKIPPED_NO_RECIPIENTS',
      channel: 'SYSTEM',
      metadata: {
        at: now.toISOString(),
        offlineSince: offlineSince.toISOString(),
        lastPingAt: heartbeat.lastPingAt.toISOString(),
      },
    });
    return { status: 'no_recipients', lastPingAt: heartbeat.lastPingAt.toISOString() };
  }

  try {
    await sendEmail({
      to: recipientEmails,
      subject: isReminder ? 'Reminder: Design Processor still offline' : 'Design Processor Offline',
      react: ProcessorOfflineAlertEmail({
        isReminder,
        lastPingTime: heartbeat.lastPingAt.toISOString(),
        timeSinceLastPing: formatProcessorOfflineDuration(msSinceLastPing),
        adminUrl: buildAdminUrl(),
        thresholdSeconds: Math.floor(thresholdMs / 1000),
        reminderMinutes: Math.floor(reminderIntervalMs / 60_000),
      }),
    });
  } catch (error) {
    await releaseProcessorOfflineAlertClaim(claim);
    throw error;
  }

  await writeAuditEvent({
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

  return {
    status: isReminder ? 'reminder_sent' : 'alert_sent',
    lastPingAt: heartbeat.lastPingAt.toISOString(),
  };
}
