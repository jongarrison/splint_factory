import { Prisma } from '@prisma/client';

export const DEFAULT_PRINT_AUTO_ARCHIVE_HOURS = 24;
export const DISABLED_PRINT_AUTO_ARCHIVE_HOURS = -1;
export const MIN_PRINT_AUTO_ARCHIVE_HOURS = 1;
export const MAX_PRINT_AUTO_ARCHIVE_HOURS = 720;

type AutoArchiveClient = {
  printJob: {
    updateManyAndReturn(args: Prisma.PrintJobUpdateManyAndReturnArgs): Promise<Array<{
      id: string;
      designJobId: string;
      printCompletedAt: Date | null;
      printerSerial: string | null;
    }>>;
  };
};

export function getPrintAutoArchiveCutoff(hours: number, now = new Date()) {
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

export function isPrintAutoArchiveEnabled(hours: number) {
  return hours !== DISABLED_PRINT_AUTO_ARCHIVE_HOURS;
}

export async function autoArchiveCompletedPrintJobs(
  client: AutoArchiveClient,
  organizationId: string,
  hours: number,
  now = new Date(),
) {
  const where: Prisma.PrintJobWhereInput = {
    isEnabled: true,
    isPrintSuccessful: true,
    printAcceptance: null,
    printCompletedAt: { lte: getPrintAutoArchiveCutoff(hours, now) },
    designJob: { owningOrganizationId: organizationId },
  };

  return client.printJob.updateManyAndReturn({
    where,
    data: { printAcceptance: 'ARCHIVED' },
    select: {
      id: true,
      designJobId: true,
      printCompletedAt: true,
      printerSerial: true,
    },
  });
}
