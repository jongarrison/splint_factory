import { prisma } from '@/lib/prisma';
import {
  autoArchiveCompletedPrintJobs,
  DISABLED_PRINT_AUTO_ARCHIVE_HOURS,
} from '@/lib/print-auto-archive';

export async function archiveCompletedPrintJobs() {
  const organizations = await prisma.organization.findMany({
    where: {
      printAutoArchiveHours: { not: DISABLED_PRINT_AUTO_ARCHIVE_HOURS },
    },
    select: {
      id: true,
      printAutoArchiveHours: true,
    },
  });

  let archivedCount = 0;
  for (const organization of organizations) {
    const archivedJobs = await prisma.$transaction(async (tx) => {
      const jobs = await autoArchiveCompletedPrintJobs(
        tx,
        organization.id,
        organization.printAutoArchiveHours,
      );

      if (jobs.length > 0) {
        await tx.auditEvent.createMany({
          data: jobs.map((job) => ({
            eventType: 'PRINT_AUTO_ARCHIVED',
            channel: 'PRINTING',
            organizationId: organization.id,
            designJobId: job.designJobId,
            printJobId: job.id,
            printerSerial: job.printerSerial,
            metadata: {
              autoArchiveHours: organization.printAutoArchiveHours,
              printCompletedAt: job.printCompletedAt?.toISOString() ?? null,
            },
          })),
        });
      }

      return jobs;
    });
    archivedCount += archivedJobs.length;
  }

  if (archivedCount > 0) {
    console.log(`[PrintAutoArchive] Archived ${archivedCount} completed print job(s)`);
  }

  return {
    organizationsChecked: organizations.length,
    archivedCount,
  };
}
