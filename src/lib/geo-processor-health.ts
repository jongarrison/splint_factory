/**
 * In-memory tracking of geometry processor health
 * Tracks last time the geo processor called /api/geometry-processing/next-job
 */

let lastProcessorPing: number | null = null;

export function updateProcessorPing() {
  lastProcessorPing = Date.now();
}

export function getProcessorStatus(): {
  lastPingMs: number | null;
  lastPingTime: string | null;
  isHealthy: boolean;
  secondsSinceLastPing: number | null;
} {
  if (lastProcessorPing === null) {
    return {
      lastPingMs: null,
      lastPingTime: null,
      isHealthy: false,
      secondsSinceLastPing: null
    };
  }
  
  const now = Date.now();
  const timeSinceLastPing = now - lastProcessorPing;
  const secondsSinceLastPing = Math.floor(timeSinceLastPing / 1000);
  
  // Consider unhealthy if no ping in last 60 seconds
  // (processor polls every 5 seconds normally)
  const isHealthy = timeSinceLastPing < 60000;
  
  return {
    lastPingMs: lastProcessorPing,
    lastPingTime: new Date(lastProcessorPing).toISOString(),
    isHealthy,
    secondsSinceLastPing
  };
}
