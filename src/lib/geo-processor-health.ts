/**
 * In-memory tracking of geometry processor health
 * Tracks last time the geo processor called /api/geometry-processing/next-job
 */

let lastProcessorPing: number = Date.now();

export function updateProcessorPing() {
  lastProcessorPing = Date.now();
}

export function getProcessorStatus(): {
  lastPingMs: number;
  isHealthy: boolean;
  secondsSinceLastPing: number;
} {
  const now = Date.now();
  const timeSinceLastPing = now - lastProcessorPing;
  const secondsSinceLastPing = Math.floor(timeSinceLastPing / 1000);
  
  // Consider unhealthy if no ping in last 60 seconds
  // (processor polls every 5 seconds normally)
  const isHealthy = timeSinceLastPing < 60000;
  
  return {
    lastPingMs: lastProcessorPing,
    isHealthy,
    secondsSinceLastPing
  };
}
