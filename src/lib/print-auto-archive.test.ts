import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import {
  autoArchiveCompletedPrintJobs,
  isPrintAutoArchiveEnabled,
} from './print-auto-archive';

test('recognizes the disabled auto-archive setting', () => {
  assert.equal(isPrintAutoArchiveEnabled(-1), false);
  assert.equal(isPrintAutoArchiveEnabled(24), true);
});

test('archives only eligible completed prints for the requested organization', async () => {
  let updateArgs: Prisma.PrintJobUpdateManyAndReturnArgs | undefined;
  const client = {
    printJob: {
      updateManyAndReturn: async (args: Prisma.PrintJobUpdateManyAndReturnArgs) => {
        updateArgs = args;
        return [{
          id: 'print-1',
          designJobId: 'design-1',
          printCompletedAt: new Date('2026-11-24T10:00:00.000Z'),
          printerSerial: 'printer-1',
        }];
      },
    },
  };
  const now = new Date('2026-11-25T12:00:00.000Z');

  const result = await autoArchiveCompletedPrintJobs(client, 'org-1', 24, now);

  assert.equal(result.length, 1);
  assert.deepEqual(updateArgs, {
    where: {
      isEnabled: true,
      isPrintSuccessful: true,
      printAcceptance: null,
      printCompletedAt: { lte: new Date('2026-11-24T12:00:00.000Z') },
      designJob: { owningOrganizationId: 'org-1' },
    },
    data: { printAcceptance: 'ARCHIVED' },
    select: {
      id: true,
      designJobId: true,
      printCompletedAt: true,
      printerSerial: true,
    },
  });
});
