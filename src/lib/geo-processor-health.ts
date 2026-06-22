import { prisma } from '@/lib/prisma';

export const PROCESSOR_HEARTBEAT_ID = 'geo_processor';

const DEFAULT_OFFLINE_THRESHOLD_MS = 120_000;
const DEFAULT_OFFLINE_REMINDER_INTERVAL_MS = 60 * 60 * 1000;

// Keep-warm lease: each user-triggered signal extends the cutoff by this much.
export const PROCESSOR_KEEP_WARM_LEASE_MS = 10 * 60 * 1000;

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
  // Keep-warm lease surfaced to admin UI; mirrors the value the processor sees.
  keepWarmUntil: string | null;
  keepWarmRemainingSeconds: number;
}

export interface ProcessorHeartbeatSnapshot {
  id: string;
  lastPingAt: Date | null;
  offlineSince: Date | null;
  lastOfflineAlertSentAt: Date | null;
  warmUntil: Date | null;
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

  // Compute keep-warm lease values from the same heartbeat row.
  const now = Date.now();
  const warmUntilMs = heartbeat.warmUntil ? heartbeat.warmUntil.getTime() : 0;
  const keepWarmRemainingSeconds = warmUntilMs > now
    ? Math.ceil((warmUntilMs - now) / 1000)
    : 0;
  const keepWarmUntil = heartbeat.warmUntil ? heartbeat.warmUntil.toISOString() : null;

  if (!heartbeat.lastPingAt) {
    return {
      lastPingMs: null,
      lastPingTime: null,
      isHealthy: false,
      secondsSinceLastPing: null,
      offlineSince: heartbeat.offlineSince ? heartbeat.offlineSince.toISOString() : null,
      keepWarmUntil,
      keepWarmRemainingSeconds,
    };
  }

  const lastPingMs = heartbeat.lastPingAt.getTime();
  const timeSinceLastPing = now - lastPingMs;

  return {
    lastPingMs,
    lastPingTime: heartbeat.lastPingAt.toISOString(),
    isHealthy: timeSinceLastPing < offlineThresholdMs,
    secondsSinceLastPing: Math.floor(timeSinceLastPing / 1000),
    offlineSince: heartbeat.offlineSince ? heartbeat.offlineSince.toISOString() : null,
    keepWarmUntil,
    keepWarmRemainingSeconds,
  };
}

// Extend the keep-warm lease so warmUntil >= now + leaseMs (never shortens an
// existing longer lease). Called by the /design-jobs/new page on mount.
export async function extendProcessorWarmLease(
  leaseMs: number = PROCESSOR_KEEP_WARM_LEASE_MS,
): Promise<Date> {
  const now = Date.now();
  const candidate = new Date(now + leaseMs);
  const heartbeat = await getOrCreateProcessorHeartbeat();
  const current = heartbeat.warmUntil;

  if (current && current.getTime() >= candidate.getTime()) {
    return current;
  }

  const updated = await prisma.processorHeartbeat.update({
    where: { id: PROCESSOR_HEARTBEAT_ID },
    data: { warmUntil: candidate },
  });
  return updated.warmUntil ?? candidate;
}

// Seconds remaining on the keep-warm lease (0 when expired or unset). The
// processor reads this from poll responses to decide whether to keep Rhino
// warm; relative seconds avoids any reliance on processor clock accuracy.
export async function getProcessorKeepWarmRemainingSeconds(): Promise<number> {
  const heartbeat = await getOrCreateProcessorHeartbeat();
  if (!heartbeat.warmUntil) return 0;
  const remainingMs = heartbeat.warmUntil.getTime() - Date.now();
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 1000);
}
