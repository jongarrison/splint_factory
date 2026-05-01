import { getInternalTaskStatuses, ensureInternalTaskRuntimeStarted } from '../src/lib/internal-task-runtime';
import { prisma } from '../src/lib/prisma';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  ensureInternalTaskRuntimeStarted();

  // Give runOnStartup tasks a moment to execute before snapshotting status.
  await sleep(250);

  const statuses = getInternalTaskStatuses();
  console.log(JSON.stringify(statuses, null, 2));
}

main()
  .catch((error) => {
    console.error('debug-internal-tasks failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
