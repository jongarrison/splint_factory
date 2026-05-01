type TaskRunner = () => Promise<void> | void;

export interface InternalTaskDefinition {
  key: string;
  label: string;
  description?: string;
  intervalMs: number;
  runOnStartup?: boolean;
  task: TaskRunner;
}

export interface InternalTaskStatus {
  key: string;
  label: string;
  description?: string;
  intervalMs: number;
  isRunning: boolean;
  runCount: number;
  successCount: number;
  errorCount: number;
  lastRunStartedAt: string | null;
  lastRunCompletedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  nextRunAt: string | null;
}

interface RuntimeTask {
  definition: InternalTaskDefinition;
  timer: NodeJS.Timeout | null;
  isRunning: boolean;
  runCount: number;
  successCount: number;
  errorCount: number;
  lastRunStartedAt: Date | null;
  lastRunCompletedAt: Date | null;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorMessage: string | null;
  nextRunAt: Date | null;
}

const SCHEDULER_GLOBAL_KEY = '__SPLINT_INTERNAL_TASK_SCHEDULER__';

class InternalTaskScheduler {
  private readonly tasks = new Map<string, RuntimeTask>();
  private started = false;

  registerTask(definition: InternalTaskDefinition): void {
    if (this.tasks.has(definition.key)) {
      return;
    }

    const runtimeTask: RuntimeTask = {
      definition,
      timer: null,
      isRunning: false,
      runCount: 0,
      successCount: 0,
      errorCount: 0,
      lastRunStartedAt: null,
      lastRunCompletedAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      nextRunAt: null,
    };

    this.tasks.set(definition.key, runtimeTask);

    if (this.started) {
      this.startTask(runtimeTask);
    }
  }

  start(): void {
    if (this.started || typeof window !== 'undefined') {
      return;
    }

    this.started = true;

    for (const task of this.tasks.values()) {
      this.startTask(task);
    }
  }

  listStatuses(): InternalTaskStatus[] {
    return Array.from(this.tasks.values())
      .map((task) => ({
        key: task.definition.key,
        label: task.definition.label,
        description: task.definition.description,
        intervalMs: task.definition.intervalMs,
        isRunning: task.isRunning,
        runCount: task.runCount,
        successCount: task.successCount,
        errorCount: task.errorCount,
        lastRunStartedAt: task.lastRunStartedAt ? task.lastRunStartedAt.toISOString() : null,
        lastRunCompletedAt: task.lastRunCompletedAt ? task.lastRunCompletedAt.toISOString() : null,
        lastSuccessAt: task.lastSuccessAt ? task.lastSuccessAt.toISOString() : null,
        lastErrorAt: task.lastErrorAt ? task.lastErrorAt.toISOString() : null,
        lastErrorMessage: task.lastErrorMessage,
        nextRunAt: task.nextRunAt ? task.nextRunAt.toISOString() : null,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  private startTask(task: RuntimeTask): void {
    if (task.timer) {
      return;
    }

    const runTask = async () => {
      if (task.isRunning) {
        return;
      }

      task.isRunning = true;
      task.runCount += 1;
      task.lastRunStartedAt = new Date();
      task.lastErrorMessage = null;

      try {
        await task.definition.task();
        task.successCount += 1;
        task.lastSuccessAt = new Date();
      } catch (error) {
        task.errorCount += 1;
        task.lastErrorAt = new Date();
        task.lastErrorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[InternalTaskScheduler] Task ${task.definition.key} failed:`, error);
      } finally {
        task.isRunning = false;
        task.lastRunCompletedAt = new Date();
      }
    };

    if (task.definition.runOnStartup) {
      void runTask();
    }

    task.nextRunAt = new Date(Date.now() + task.definition.intervalMs);
    task.timer = setInterval(() => {
      task.nextRunAt = new Date(Date.now() + task.definition.intervalMs);
      void runTask();
    }, task.definition.intervalMs);

    if (typeof task.timer.unref === 'function') {
      task.timer.unref();
    }
  }
}

function getGlobalScheduler(): InternalTaskScheduler {
  const globalScope = globalThis as typeof globalThis & {
    [SCHEDULER_GLOBAL_KEY]?: InternalTaskScheduler;
  };

  if (!globalScope[SCHEDULER_GLOBAL_KEY]) {
    globalScope[SCHEDULER_GLOBAL_KEY] = new InternalTaskScheduler();
  }

  return globalScope[SCHEDULER_GLOBAL_KEY];
}

export function registerInternalTask(definition: InternalTaskDefinition): void {
  getGlobalScheduler().registerTask(definition);
}

export function ensureInternalTaskSchedulerStarted(): void {
  getGlobalScheduler().start();
}

export function listInternalTaskStatuses(): InternalTaskStatus[] {
  return getGlobalScheduler().listStatuses();
}
