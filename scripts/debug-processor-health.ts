import {
  getOrCreateProcessorHeartbeat,
  getProcessorStatus,
  updateProcessorPing,
} from '../src/lib/geo-processor-health';
import { prisma } from '../src/lib/prisma';

async function main(): Promise<void> {
  const beforeStatus = await getProcessorStatus();
  const beforeHeartbeat = await getOrCreateProcessorHeartbeat();

  await updateProcessorPing();

  const afterStatus = await getProcessorStatus();
  const afterHeartbeat = await getOrCreateProcessorHeartbeat();

  const summary = {
    beforeStatus,
    beforeHeartbeat,
    afterStatus,
    afterHeartbeat,
    pingUpdated: beforeStatus.lastPingMs !== afterStatus.lastPingMs,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error('debug-processor-health failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
