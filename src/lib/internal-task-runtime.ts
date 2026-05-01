import {
  ensureInternalTaskSchedulerStarted,
  listInternalTaskStatuses,
} from '@/lib/internal-task-scheduler';
import { registerProcessorOfflineMonitorTask } from '@/lib/processor-offline-monitor';

function internalTasksEnabled(): boolean {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return false;
  }

  return process.env.INTERNAL_TASKS_DISABLED !== 'true';
}

export function ensureInternalTaskRuntimeStarted(): void {
  if (typeof window !== 'undefined' || !internalTasksEnabled()) {
    return;
  }

  registerProcessorOfflineMonitorTask();
  ensureInternalTaskSchedulerStarted();
}

export function getInternalTaskStatuses() {
  return listInternalTaskStatuses();
}
