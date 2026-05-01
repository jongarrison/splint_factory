import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { logAuditEvent } from '@/lib/audit';
import ProcessorOfflineAlertEmail from '@/emails/processor-offline-alert';
import {
  getOrCreateProcessorHeartbeat,
  getProcessorOfflineReminderIntervalMs,
  getProcessorOfflineThresholdMs,
} from '@/lib/geo-processor-health';

function buildAdminUrl(request: NextRequest): string {
  const configuredBaseUrl = process.env.NEXTAUTH_URL;
  if (configuredBaseUrl) {
    return `${configuredBaseUrl.replace(/\/$/, '')}/admin`;
  }

  return `${request.nextUrl.origin}/admin`;
}

// POST /api/admin/notifications/test - Send a test processor alert to opted-in SYSTEM_ADMIN users
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.role || session.user.role !== 'SYSTEM_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 401 });
    }

    const recipients = await prisma.user.findMany({
      where: {
        role: 'SYSTEM_ADMIN',
        siteAlertOptIn: true,
      },
      select: {
        email: true,
      },
    });

    const recipientEmails = recipients.map((recipient) => recipient.email).filter(Boolean);

    if (recipientEmails.length === 0) {
      return NextResponse.json({
        error: 'No SYSTEM_ADMIN users are currently opted in for site alerts.',
      }, { status: 400 });
    }

    const heartbeat = await getOrCreateProcessorHeartbeat();
    const now = new Date();
    const lastPing = heartbeat.lastPingAt || now;

    await sendEmail({
      to: recipientEmails,
      subject: 'Test: Design Processor Offline Alert',
      react: ProcessorOfflineAlertEmail({
        isReminder: false,
        lastPingTime: lastPing.toISOString(),
        offlineDuration: 'test notification',
        adminUrl: buildAdminUrl(request),
        thresholdSeconds: Math.floor(getProcessorOfflineThresholdMs() / 1000),
        reminderMinutes: Math.floor(getProcessorOfflineReminderIntervalMs() / 60_000),
      }),
    });

    logAuditEvent({
      eventType: 'PROCESSOR_OFFLINE_TEST_ALERT_SENT',
      channel: 'SYSTEM',
      actorId: session.user.id,
      metadata: {
        recipientCount: recipientEmails.length,
      },
    });

    return NextResponse.json({
      success: true,
      recipientCount: recipientEmails.length,
      recipients: recipientEmails,
    });
  } catch (error) {
    console.error('Error sending test site alert:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to send test alert',
    }, { status: 500 });
  }
}
