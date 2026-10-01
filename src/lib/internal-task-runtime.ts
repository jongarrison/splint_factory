import {
  ensureInternalTaskSchedulerStarted,
  listInternalTaskStatuses,
} from '@/lib/internal-task-scheduler';
import { registerProcessorOfflineMonitorTask } from '@/lib/processor-offline-monitor';
import { registerDailyDigestTask } from '@/lib/daily-digest-task';
import { registerAuditLogCleanupTask } from '@/lib/audit-log-cleanup-task';

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
  registerDailyDigestTask();
  registerAuditLogCleanupTask();
  ensureInternalTaskSchedulerStarted();
}

export function getInternalTaskStatuses() {
  return listInternalTaskStatuses();
}
