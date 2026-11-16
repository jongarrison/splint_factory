export type ProcessorOfflineAlertKind = 'initial' | 'reminder' | null;

interface ProcessorOfflinePolicyState {
  lastPingAt: Date | null;
  lastOfflineAlertSentAt: Date | null;
}

/** Returns the alert due for a heartbeat snapshot at the supplied time. */
export function getProcessorOfflineAlertKind(
  heartbeat: ProcessorOfflinePolicyState,
  now: Date,
  thresholdMs: number,
  reminderIntervalMs: number,
): ProcessorOfflineAlertKind {
  if (!heartbeat.lastPingAt) {
    return null;
  }

  const msSinceLastPing = now.getTime() - heartbeat.lastPingAt.getTime();
  if (msSinceLastPing < thresholdMs) {
    return null;
  }

  if (!heartbeat.lastOfflineAlertSentAt) {
    return 'initial';
  }

  return now.getTime() - heartbeat.lastOfflineAlertSentAt.getTime() >= reminderIntervalMs
    ? 'reminder'
    : null;
}

/** Formats elapsed milliseconds for human-readable monitoring notifications. */
export function formatProcessorOfflineDuration(durationMs: number): string {
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
