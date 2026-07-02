import { prisma } from '@/lib/prisma';
import { generateObjectId } from '@/lib/objectId';

export const HEALTH_CHECK_JOB_LABEL_PREFIX = 'processor-health-check:';
const DEFAULT_HEALTH_CHECK_WAIT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_HEALTH_CHECK_POLL_INTERVAL_MS = 5000;

export type ProcessorHealthCheckSource = 'admin-manual' | 'daily-digest';
export type ProcessorHealthCheckStatus = 'PASSED' | 'FAILED' | 'TIMEOUT' | 'ERROR';

export interface ProcessorHealthCheckJobResult {
  id: string;
  objectId: string | null;
  createdAt: Date;
  source: ProcessorHealthCheckSource;
}

export interface ProcessorHealthCheckOutcome {
  status: ProcessorHealthCheckStatus;
  source: ProcessorHealthCheckSource;
  jobId: string | null;
  objectId: string | null;
  createdAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  durationSeconds: number | null;
  failurePreview: string | null;
}

function getPositiveIntFromEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];
  const parsed = rawValue ? Number(rawValue) : NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

export function getProcessorHealthCheckWaitTimeoutMs(): number {
  return getPositiveIntFromEnv('PROCESSOR_HEALTH_CHECK_WAIT_TIMEOUT_MS', DEFAULT_HEALTH_CHECK_WAIT_TIMEOUT_MS);
}

export function getProcessorHealthCheckPollIntervalMs(): number {
  return getPositiveIntFromEnv('PROCESSOR_HEALTH_CHECK_POLL_INTERVAL_MS', DEFAULT_HEALTH_CHECK_POLL_INTERVAL_MS);
}

export function buildProcessorHealthCheckJobLabel(source: ProcessorHealthCheckSource): string {
  return `${HEALTH_CHECK_JOB_LABEL_PREFIX}${source}`;
}

function parseProcessorHealthCheckSource(jobLabel: string | null): ProcessorHealthCheckSource | null {
  if (!jobLabel || !jobLabel.startsWith(HEALTH_CHECK_JOB_LABEL_PREFIX)) {
    return null;
  }

  const value = jobLabel.slice(HEALTH_CHECK_JOB_LABEL_PREFIX.length).trim();
  if (value === 'admin-manual' || value === 'daily-digest') {
    return value;
  }

  return null;
}

function extractFailurePreview(log: string | null): string | null {
  if (!log) return null;

  const lines = log
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return null;

  const tail = lines.slice(-6).join(' | ');
  if (tail.length <= 240) return tail;
  return `${tail.slice(0, 237)}...`;
}

function buildOutcomeFromJobState(args: {
  source: ProcessorHealthCheckSource;
  jobId: string;
  fallbackObjectId: string | null;
  fallbackCreatedAt: Date;
  processStartedAt: Date | null;
  processCompletedAt: Date | null;
  isProcessSuccessful: boolean;
  processingLog: string | null;
  objectId: string | null;
}): ProcessorHealthCheckOutcome {
  const startedAt = args.processStartedAt ?? null;
  const completedAt = args.processCompletedAt ?? null;
  const createdAt = args.fallbackCreatedAt;

  let durationSeconds: number | null = null;
  if (startedAt && completedAt) {
    durationSeconds = (completedAt.getTime() - startedAt.getTime()) / 1000;
  } else if (startedAt) {
    durationSeconds = (Date.now() - startedAt.getTime()) / 1000;
  } else {
    durationSeconds = (Date.now() - createdAt.getTime()) / 1000;
  }

  return {
    status: args.isProcessSuccessful ? 'PASSED' : 'FAILED',
    source: args.source,
    jobId: args.jobId,
    objectId: args.objectId ?? args.fallbackObjectId,
    createdAt,
    startedAt,
    completedAt,
    durationSeconds,
    failurePreview: args.isProcessSuccessful ? null : extractFailurePreview(args.processingLog),
  };
}

function buildErrorOutcome(params: {
  source: ProcessorHealthCheckSource;
  jobId: string | null;
  objectId: string | null;
  createdAt: Date | null;
  message: string;
}): ProcessorHealthCheckOutcome {
  return {
    status: 'ERROR',
    source: params.source,
    jobId: params.jobId,
    objectId: params.objectId,
    createdAt: params.createdAt,
    startedAt: null,
    completedAt: null,
    durationSeconds: null,
    failurePreview: params.message,
  };
}

async function resolveCreatorUserId(creatorUserId?: string): Promise<string> {
  if (creatorUserId) {
    return creatorUserId;
  }

  const fallbackAdmin = await prisma.user.findFirst({
    where: {
      role: 'SYSTEM_ADMIN',
      organizationId: { not: null },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  if (!fallbackAdmin?.id) {
    throw new Error('No SYSTEM_ADMIN user with an organization found for health check job creation.');
  }

  return fallbackAdmin.id;
}

export async function createProcessorHealthCheckJob(options: {
  source: ProcessorHealthCheckSource;
  creatorUserId?: string;
}): Promise<ProcessorHealthCheckJobResult> {
  const creatorId = await resolveCreatorUserId(options.creatorUserId);

  const systemOrg = await prisma.organization.findUnique({
    where: { name: 'System Administration' },
    select: { id: true },
  });

  if (!systemOrg) {
    throw new Error('"System Administration" organization not found. Run the seed script.');
  }

  const cylinderDesign = await prisma.design.findFirst({
    where: { algorithmName: 'cylinder' },
    select: { id: true },
  });

  if (!cylinderDesign) {
    throw new Error('Cylinder test geometry not found. Create a Design with algorithmName "cylinder" first.');
  }

  const objectId = await generateObjectId();
  const jobLabel = buildProcessorHealthCheckJobLabel(options.source);

  const job = await prisma.designJob.create({
    data: {
      designId: cylinderDesign.id,
      creatorId,
      owningOrganizationId: systemOrg.id,
      inputParameters: JSON.stringify({ radius: 10, height: 10 }),
      isDebugRequest: true,
      objectId,
      objectIdGeneratedAt: new Date(),
      jobLabel,
      isEnabled: true,
    },
    select: {
      id: true,
      objectId: true,
      createdAt: true,
    },
  });

  return {
    id: job.id,
    objectId: job.objectId,
    createdAt: job.createdAt,
    source: options.source,
  };
}

export async function waitForProcessorHealthCheckJob(options: {
  jobId: string;
  source: ProcessorHealthCheckSource;
  objectId: string | null;
  createdAt: Date;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<ProcessorHealthCheckOutcome> {
  const timeoutMs = options.timeoutMs ?? getProcessorHealthCheckWaitTimeoutMs();
  const pollIntervalMs = options.pollIntervalMs ?? getProcessorHealthCheckPollIntervalMs();
  const waitStart = Date.now();

  while (Date.now() - waitStart < timeoutMs) {
    const job = await prisma.designJob.findUnique({
      where: { id: options.jobId },
      select: {
        objectId: true,
        createdAt: true,
        jobLabel: true,
        processStartedAt: true,
        processCompletedAt: true,
        isProcessSuccessful: true,
        processingLog: true,
      },
    });

    if (!job) {
      return buildErrorOutcome({
        source: options.source,
        jobId: options.jobId,
        objectId: options.objectId,
        createdAt: options.createdAt,
        message: 'Health check job could not be found while waiting for completion.',
      });
    }

    const source = parseProcessorHealthCheckSource(job.jobLabel) ?? options.source;
    if (job.processCompletedAt) {
      return buildOutcomeFromJobState({
        source,
        jobId: options.jobId,
        fallbackObjectId: options.objectId,
        fallbackCreatedAt: options.createdAt,
        processStartedAt: job.processStartedAt,
        processCompletedAt: job.processCompletedAt,
        isProcessSuccessful: job.isProcessSuccessful,
        processingLog: job.processingLog,
        objectId: job.objectId,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  const latest = await prisma.designJob.findUnique({
    where: { id: options.jobId },
    select: {
      objectId: true,
      processStartedAt: true,
      processCompletedAt: true,
      isProcessSuccessful: true,
      processingLog: true,
      jobLabel: true,
    },
  });

  if (latest?.processCompletedAt) {
    const source = parseProcessorHealthCheckSource(latest.jobLabel) ?? options.source;
    return buildOutcomeFromJobState({
      source,
      jobId: options.jobId,
      fallbackObjectId: options.objectId,
      fallbackCreatedAt: options.createdAt,
      processStartedAt: latest.processStartedAt,
      processCompletedAt: latest.processCompletedAt,
      isProcessSuccessful: latest.isProcessSuccessful,
      processingLog: latest.processingLog,
      objectId: latest.objectId,
    });
  }

  const startedAt = latest?.processStartedAt ?? null;
  const durationSeconds = startedAt
    ? (Date.now() - startedAt.getTime()) / 1000
    : (Date.now() - options.createdAt.getTime()) / 1000;

  return {
    status: 'TIMEOUT',
    source: options.source,
    jobId: options.jobId,
    objectId: latest?.objectId ?? options.objectId,
    createdAt: options.createdAt,
    startedAt,
    completedAt: latest?.processCompletedAt ?? null,
    durationSeconds,
    failurePreview: `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for processor health check completion.`,
  };
}

export async function runDigestProcessorHealthCheck(options: {
  creatorUserId?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
} = {}): Promise<ProcessorHealthCheckOutcome> {
  let created: ProcessorHealthCheckJobResult | null = null;

  try {
    created = await createProcessorHealthCheckJob({
      source: 'daily-digest',
      creatorUserId: options.creatorUserId,
    });
  } catch (error: any) {
    return buildErrorOutcome({
      source: 'daily-digest',
      jobId: null,
      objectId: null,
      createdAt: null,
      message: `Failed to queue digest processor self-check: ${error?.message || 'unknown error'}`,
    });
  }

  return waitForProcessorHealthCheckJob({
    jobId: created.id,
    source: created.source,
    objectId: created.objectId,
    createdAt: created.createdAt,
    timeoutMs: options.timeoutMs,
    pollIntervalMs: options.pollIntervalMs,
  });
}
