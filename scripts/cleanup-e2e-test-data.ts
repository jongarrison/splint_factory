#!/usr/bin/env tsx
/**
 * Cleanup E2E test data.
 *
 * Removes DesignJobs (and their dependent PrintJobs) owned by the configured
 * test organization whose jobLabel starts with the given prefix (default: "e2e-").
 *
 * Usage:
 *   # against local DB (uses DATABASE_URL from .env / current shell)
 *   tsx scripts/cleanup-e2e-test-data.ts --dry-run
 *   tsx scripts/cleanup-e2e-test-data.ts
 *
 *   # against prod, point DATABASE_URL at prod and run with care
 *   DATABASE_URL='postgresql://...' tsx scripts/cleanup-e2e-test-data.ts --dry-run
 *
 * Flags:
 *   --dry-run         List what would be deleted, do nothing.
 *   --org "Name"      Override org name (default: $E2E_ORG_NAME or "Automated Test Clinic").
 *   --prefix "str"    Override label prefix (default: "e2e-").
 *   --yes             Skip interactive confirmation prompt.
 */
import { PrismaClient } from '@prisma/client';
import readline from 'readline';
import { getBlobStorageInstance } from '../src/lib/blob-storage';

const prisma = new PrismaClient();

interface Args {
  dryRun: boolean;
  orgName: string;
  prefix: string;
  yes: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: false,
    orgName: process.env.E2E_ORG_NAME || 'Automated Test Clinic',
    prefix: 'e2e-',
    yes: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--yes') args.yes = true;
    else if (a === '--org') args.orgName = argv[++i];
    else if (a === '--prefix') args.prefix = argv[++i];
  }
  return args;
}

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} [y/N]: `, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const org = await prisma.organization.findFirst({ where: { name: args.orgName } });
  if (!org) {
    console.error(`Org "${args.orgName}" not found. Aborting.`);
    process.exit(1);
  }

  const jobs = await prisma.designJob.findMany({
    where: {
      owningOrganizationId: org.id,
      jobLabel: { startsWith: args.prefix },
    },
    select: {
      id: true,
      jobLabel: true,
      createdAt: true,
      meshBlobPathname: true,
      printBlobPathname: true,
      _count: { select: { printJobs: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (jobs.length === 0) {
    console.log(`No matching e2e jobs in "${args.orgName}" with prefix "${args.prefix}".`);
    return;
  }

  const blobPaths = jobs.flatMap((j) =>
    [j.meshBlobPathname, j.printBlobPathname].filter((p): p is string => !!p)
  );

  console.log(`Found ${jobs.length} test job(s) in "${args.orgName}":`);
  for (const j of jobs) {
    const blobs = [j.meshBlobPathname, j.printBlobPathname].filter(Boolean).length;
    console.log(
      `  ${j.id}  ${j.createdAt.toISOString()}  ${j.jobLabel}  (printJobs: ${j._count.printJobs}, blobs: ${blobs})`
    );
  }
  console.log(`Total blob artifacts to delete: ${blobPaths.length}`);

  if (args.dryRun) {
    console.log('\n--dry-run: no changes made.');
    return;
  }

  if (!args.yes) {
    const ok = await confirm(`\nDelete these ${jobs.length} job(s), their PrintJobs, and ${blobPaths.length} blob(s)?`);
    if (!ok) {
      console.log('Aborted.');
      return;
    }
  }

  // Delete blobs first; if blob delete fails for some, the row delete below
  // would orphan them. Best-effort and report.
  const blob = getBlobStorageInstance();
  let blobsDeleted = 0;
  let blobsFailed = 0;
  for (const pathname of blobPaths) {
    try {
      await blob.delete(pathname);
      blobsDeleted++;
    } catch (err) {
      blobsFailed++;
      console.warn(`  ! Failed to delete blob ${pathname}:`, (err as Error).message);
    }
  }

  const jobIds = jobs.map((j) => j.id);
  const result = await prisma.$transaction([
    prisma.printJob.deleteMany({ where: { designJobId: { in: jobIds } } }),
    prisma.designJob.deleteMany({ where: { id: { in: jobIds } } }),
  ]);
  console.log(
    `Deleted ${result[0].count} PrintJob row(s), ${result[1].count} DesignJob row(s), ${blobsDeleted} blob(s) (${blobsFailed} blob failure(s)).`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
