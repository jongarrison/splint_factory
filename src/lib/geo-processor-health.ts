import { prisma } from '@/lib/prisma';

export const PROCESSOR_HEARTBEAT_ID = 'geo_processor';

const DEFAULT_OFFLINE_THRESHOLD_MS = 120_000;
const DEFAULT_OFFLINE_REMINDER_INTERVAL_MS = 60 * 60 * 1000;

function getPositiveIntFromEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];
  const parsed = rawValue ? Number(rawValue) : NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

export function getProcessorOfflineThresholdMs(): number {
  return getPositiveIntFromEnv('PROCESSOR_OFFLINE_THRESHOLD_MS', DEFAULT_OFFLINE_THRESHOLD_MS);
}

export function getProcessorOfflineReminderIntervalMs(): number {
  return getPositiveIntFromEnv('PROCESSOR_OFFLINE_REMINDER_INTERVAL_MS', DEFAULT_OFFLINE_REMINDER_INTERVAL_MS);
}

export interface ProcessorStatus {
  lastPingMs: number | null;
  lastPingTime: string | null;
  isHealthy: boolean;
  secondsSinceLastPing: number | null;
  offlineSince: string | null;
}

export interface ProcessorHeartbeatSnapshot {
  id: string;
  lastPingAt: Date | null;
  offlineSince: Date | null;
  lastOfflineAlertSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getOrCreateProcessorHeartbeat(): Promise<ProcessorHeartbeatSnapshot> {
  return prisma.processorHeartbeat.upsert({
    where: { id: PROCESSOR_HEARTBEAT_ID },
    update: {},
    create: { id: PROCESSOR_HEARTBEAT_ID },
  });
}

export async function updateProcessorPing(pingTime: Date = new Date()): Promise<void> {
  await prisma.processorHeartbeat.upsert({
    where: { id: PROCESSOR_HEARTBEAT_ID },
    update: {
      lastPingAt: pingTime,
      offlineSince: null,
      lastOfflineAlertSentAt: null,
    },
    create: {
      id: PROCESSOR_HEARTBEAT_ID,
      lastPingAt: pingTime,
    },
  });
}

export async function clearProcessorOfflineState(): Promise<void> {
  await prisma.processorHeartbeat.upsert({
    where: { id: PROCESSOR_HEARTBEAT_ID },
    update: {
      offlineSince: null,
      lastOfflineAlertSentAt: null,
    },
    create: {
      id: PROCESSOR_HEARTBEAT_ID,
    },
  });
}

export async function setProcessorOfflineState(offlineSince: Date): Promise<void> {
  const heartbeat = await getOrCreateProcessorHeartbeat();

  if (heartbeat.offlineSince) {
    return;
  }

  await prisma.processorHeartbeat.update({
    where: { id: PROCESSOR_HEARTBEAT_ID },
    data: { offlineSince },
  });
}

export async function setProcessorOfflineAlertSent(sentAt: Date): Promise<void> {
  await prisma.processorHeartbeat.upsert({
    where: { id: PROCESSOR_HEARTBEAT_ID },
    update: {
      lastOfflineAlertSentAt: sentAt,
    },
    create: {
      id: PROCESSOR_HEARTBEAT_ID,
      lastOfflineAlertSentAt: sentAt,
    },
  });
}

export async function getProcessorStatus(
  offlineThresholdMs: number = getProcessorOfflineThresholdMs(),
): Promise<ProcessorStatus> {
  const heartbeat = await getOrCreateProcessorHeartbeat();

  if (!heartbeat.lastPingAt) {
    return {
      lastPingMs: null,
      lastPingTime: null,
      isHealthy: false,
      secondsSinceLastPing: null,
      offlineSince: heartbeat.offlineSince ? heartbeat.offlineSince.toISOString() : null,
    };
  }

  const now = Date.now();
  const lastPingMs = heartbeat.lastPingAt.getTime();
  const timeSinceLastPing = now - lastPingMs;

  return {
    lastPingMs,
    lastPingTime: heartbeat.lastPingAt.toISOString(),
    isHealthy: timeSinceLastPing < offlineThresholdMs,
    secondsSinceLastPing: Math.floor(timeSinceLastPing / 1000),
    offlineSince: heartbeat.offlineSince ? heartbeat.offlineSince.toISOString() : null,
  };
}
