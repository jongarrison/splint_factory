import { prisma } from '@/lib/prisma';
import {
  type OrgDesignJobStats,
  type OrgPrintStats,
  type MoreInfoSummary,
  type ProcessorHealthSummary,
  type NewUserSummary,
} from '@/emails/daily-digest';

export function buildAdminUrl(): string {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/admin`;
}

export async function gatherDigestData(since: Date): Promise<{
  designJobs: OrgDesignJobStats[];
  prints: OrgPrintStats[];
  moreInfo: MoreInfoSummary;
  processor: ProcessorHealthSummary;
  newUsers: NewUserSummary;
}> {
  const [designJobRows, printRows, moreInfoRows, heartbeat, newUserRows, totalUsers, totalOrgs] = await Promise.all([
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
    if (print.printAcceptance === 'REJECTED') s.rejected += 1;
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
  const processor: ProcessorHealthSummary = {
    wasOffline: Boolean(wasOffline),
    offlineDurationMinutes,
    currentlyOnline,
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
