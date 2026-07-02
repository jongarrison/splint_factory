import { prisma } from '@/lib/prisma';
import {
  type OrgDesignJobStats,
  type OrgPrintStats,
  type MoreInfoSummary,
  type ProcessorHealthSummary,
  type NewUserSummary,
} from '@/emails/daily-digest';
import { HEALTH_CHECK_JOB_LABEL_PREFIX, type ProcessorHealthCheckOutcome } from '@/lib/processor-health-check';

export function buildAdminUrl(): string {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/admin`;
}

function extractSelfCheckFailurePreview(log: string | null): string | null {
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

function parseSelfCheckSource(jobLabel: string | null): string | null {
  if (!jobLabel || !jobLabel.startsWith(HEALTH_CHECK_JOB_LABEL_PREFIX)) {
    return null;
  }
  const source = jobLabel.slice(HEALTH_CHECK_JOB_LABEL_PREFIX.length).trim();
  return source.length > 0 ? source : null;
}

export async function gatherDigestData(
  since: Date,
  options: { digestSelfCheck?: ProcessorHealthCheckOutcome | null } = {},
): Promise<{
  designJobs: OrgDesignJobStats[];
  prints: OrgPrintStats[];
  moreInfo: MoreInfoSummary;
  processor: ProcessorHealthSummary;
  newUsers: NewUserSummary;
}> {
  const [designJobRows, printRows, moreInfoRows, heartbeat, latestSelfCheck, latestCompletedSelfCheck, newUserRows, totalUsers, totalOrgs] = await Promise.all([
    // Design jobs completed (or in-progress) in the window
    prisma.designJob.findMany({
      where: {
        OR: [
          { processCompletedAt: { gte: since } },
          { processStartedAt: { gte: since }, processCompletedAt: null },
        ],
      },
      select: {
        isProcessSuccessful: true,
        processCompletedAt: true,
        owningOrganization: { select: { name: true } },
      },
    }),

    // Print jobs created in the window
    prisma.printJob.findMany({
      where: { createdAt: { gte: since } },
      select: {
        isPrintSuccessful: true,
        printAcceptance: true,
        printCompletedAt: true,
        designJob: {
          select: { owningOrganization: { select: { name: true } } },
        },
      },
    }),

    // More-info submissions
    prisma.moreInfoRequest.findMany({
      where: { createdAt: { gte: since } },
      select: { name: true, data: true },
    }),

    // Processor heartbeat
    prisma.processorHeartbeat.findFirst({ where: { id: 'geo_processor' } }),

    // Latest processor self-check job created by admin or digest automation
    prisma.designJob.findFirst({
      where: {
        isDebugRequest: true,
        jobLabel: { startsWith: HEALTH_CHECK_JOB_LABEL_PREFIX },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        objectId: true,
        jobLabel: true,
        createdAt: true,
        processStartedAt: true,
        processCompletedAt: true,
        isProcessSuccessful: true,
        processingLog: true,
      },
    }),

    prisma.designJob.findFirst({
      where: {
        isDebugRequest: true,
        jobLabel: { startsWith: HEALTH_CHECK_JOB_LABEL_PREFIX },
        processCompletedAt: { not: null },
      },
      orderBy: { processCompletedAt: 'desc' },
      select: {
        objectId: true,
        jobLabel: true,
        createdAt: true,
        processStartedAt: true,
        processCompletedAt: true,
        isProcessSuccessful: true,
        processingLog: true,
      },
    }),

    // New user registrations
    prisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: { email: true },
    }),

    // Totals for context
    prisma.user.count(),
    prisma.organization.count(),
  ]);

  // -- Design jobs by org --
  const designByOrg = new Map<string, OrgDesignJobStats>();
  for (const job of designJobRows) {
    const org = job.owningOrganization.name;
    if (!designByOrg.has(org)) {
      designByOrg.set(org, { orgName: org, total: 0, succeeded: 0, failed: 0, inProgress: 0 });
    }
    const s = designByOrg.get(org)!;
    s.total += 1;
    if (job.processCompletedAt == null) {
      s.inProgress += 1;
    } else if (job.isProcessSuccessful) {
      s.succeeded += 1;
    } else {
      s.failed += 1;
    }
  }

  // -- Prints by org --
  const printByOrg = new Map<string, OrgPrintStats>();
  for (const print of printRows) {
    const org = print.designJob.owningOrganization.name;
    if (!printByOrg.has(org)) {
      printByOrg.set(org, { orgName: org, total: 0, succeeded: 0, failed: 0, accepted: 0, rejected: 0, pending: 0 });
    }
    const s = printByOrg.get(org)!;
    s.total += 1;
    if (print.printCompletedAt == null) {
      s.pending += 1;
    } else if (print.isPrintSuccessful) {
      s.succeeded += 1;
    } else {
      s.failed += 1;
    }
    if (print.printAcceptance === 'ACCEPTED') s.accepted += 1;
    // REJECT_PRINT and REJECT_DESIGN are the current values; REJECTED is legacy
    if (['REJECTED', 'REJECT_PRINT', 'REJECT_DESIGN'].includes(print.printAcceptance ?? '')) s.rejected += 1;
  }

  // -- More-info summary --
  const moreInfo: MoreInfoSummary = {
    count: moreInfoRows.length,
    names: moreInfoRows.map(r => {
      const d = r.data as { organization?: string } | null;
      return d?.organization ? `${r.name} (${d.organization})` : r.name;
    }),
  };

  // -- Processor health --
  const now = new Date();
  const currentlyOnline = heartbeat?.lastPingAt
    ? now.getTime() - heartbeat.lastPingAt.getTime() < 3 * 60 * 1000
    : false;
  const wasOffline = Boolean(heartbeat?.offlineSince && heartbeat.offlineSince >= since)
    || (!currentlyOnline && heartbeat?.lastPingAt && heartbeat.lastPingAt >= since);
  let offlineDurationMinutes: number | null = null;
  if (heartbeat?.offlineSince && heartbeat.offlineSince >= since) {
    offlineDurationMinutes = Math.round((now.getTime() - heartbeat.offlineSince.getTime()) / 60000);
  }
  const completedSelfCheckStatus = latestCompletedSelfCheck
    ? latestCompletedSelfCheck.isProcessSuccessful
      ? 'PASSED'
      : 'FAILED'
    : null;

  const selfCheckReference = latestCompletedSelfCheck ?? latestSelfCheck;
  const digestSelfCheck = options.digestSelfCheck ?? null;

  const processor: ProcessorHealthSummary = {
    wasOffline: Boolean(wasOffline),
    offlineDurationMinutes,
    currentlyOnline,
    digestSelfCheckStatus: digestSelfCheck?.status ?? 'NOT_RUN',
    digestSelfCheckObjectId: digestSelfCheck?.objectId ?? null,
    digestSelfCheckDurationSeconds: digestSelfCheck?.durationSeconds ?? null,
    digestSelfCheckFailurePreview: digestSelfCheck?.failurePreview ?? null,
    lastSelfCheckStatus: completedSelfCheckStatus
      ? completedSelfCheckStatus
      : latestSelfCheck
        ? latestSelfCheck.processStartedAt
          ? 'RUNNING'
          : 'QUEUED'
        : 'NONE',
    lastSelfCheckSource: parseSelfCheckSource(selfCheckReference?.jobLabel ?? null),
    lastSelfCheckObjectId: selfCheckReference?.objectId ?? null,
    lastSelfCheckCreatedAt: selfCheckReference?.createdAt?.toISOString() ?? null,
    lastSelfCheckCompletedAt: selfCheckReference?.processCompletedAt?.toISOString() ?? null,
    lastSelfCheckDurationSeconds:
      selfCheckReference?.processStartedAt && selfCheckReference?.processCompletedAt
        ? (selfCheckReference.processCompletedAt.getTime() - selfCheckReference.processStartedAt.getTime()) / 1000
        : null,
    lastSelfCheckFailurePreview:
      selfCheckReference?.processCompletedAt && !selfCheckReference?.isProcessSuccessful
        ? extractSelfCheckFailurePreview(selfCheckReference.processingLog ?? null)
        : null,
  };

  // -- New users --
  const newUsers: NewUserSummary = {
    count: newUserRows.length,
    emails: newUserRows.map(u => u.email).filter((e): e is string => e !== null),
    totalUsers,
    totalOrgs,
  };

  return {
    designJobs: Array.from(designByOrg.values()).sort((a, b) => a.orgName.localeCompare(b.orgName)),
    prints: Array.from(printByOrg.values()).sort((a, b) => a.orgName.localeCompare(b.orgName)),
    moreInfo,
    processor,
    newUsers,
  };
}
