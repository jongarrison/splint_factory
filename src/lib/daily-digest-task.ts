import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { registerInternalTask } from '@/lib/internal-task-scheduler';
import { gatherDigestData, buildAdminUrl } from '@/lib/daily-digest';
import DailyDigestEmail from '@/emails/daily-digest';
import { getBlobStorageInstance } from '@/lib/blob-storage';
import { runDigestProcessorHealthCheck } from '@/lib/processor-health-check';

const TASK_KEY = 'daily-digest';

// Timezone for digest scheduling. Defaults to Pacific Time.
// Set DAILY_DIGEST_TIMEZONE to any IANA timezone (e.g. 'America/New_York').
function getDigestTimezone(): string {
  return process.env.DAILY_DIGEST_TIMEZONE || 'America/Los_Angeles';
}

// Hour of day in the digest timezone to send, default 4am.
function getDigestHour(): number {
  const raw = process.env.DAILY_DIGEST_HOUR;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 23 ? parsed : 4;
}

// Current hour in the digest timezone (handles DST automatically via Intl).
function getCurrentHourInTimezone(timezone: string): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }).format(new Date()),
    10
  );
}

// Allow retries for up to this many hours after the target hour (handles transient failures)
const RETRY_WINDOW_HOURS = 3;

// Read/write last-sent date from SystemSettings so it survives server restarts
async function getLastSentDate(): Promise<string | null> {
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'system_settings' } });
  return settings?.lastDailyDigestSentDate ?? null;
}

async function setLastSentDate(date: string): Promise<void> {
  await prisma.systemSettings.upsert({
    where: { id: 'system_settings' },
    update: { lastDailyDigestSentDate: date },
    create: { id: 'system_settings', lastDailyDigestSentDate: date },
  });
}

// Today's date string (YYYY-MM-DD) in the digest timezone.
function todayString(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date()); // en-CA gives YYYY-MM-DD
}


async function sendDailyDigest(): Promise<void> {
  const timezone = getDigestTimezone();
  const digestHour = getDigestHour();
  const currentHour = getCurrentHourInTimezone(timezone);

  // Send within the retry window: from digestHour up to digestHour + RETRY_WINDOW_HOURS
  const hoursSinceTarget = (currentHour - digestHour + 24) % 24;
  if (hoursSinceTarget > RETRY_WINDOW_HOURS) {
    return;
  }

  const today = todayString(timezone);
  if (await getLastSentDate() === today) {
    return; // already sent today
  }

  const recipients = await prisma.user.findMany({
    where: { role: 'SYSTEM_ADMIN', siteAlertOptIn: true },
    select: { email: true },
  });

  if (recipients.length === 0) {
    await setLastSentDate(today);
    return;
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const digestSelfCheck = await runDigestProcessorHealthCheck();
  console.log(
    `[DailyDigest] Pre-send processor self-check ${digestSelfCheck.status}` +
      `${digestSelfCheck.objectId ? ` (${digestSelfCheck.objectId})` : ''}`,
  );

  const data = await gatherDigestData(since, { digestSelfCheck });

  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  await sendEmail({
    to: recipients.map(u => u.email).filter((e): e is string => e !== null),
    subject: `Splint Factory daily digest - ${reportDate}`,
    react: DailyDigestEmail({
      reportDate,
      windowHours: 24,
      adminUrl: buildAdminUrl(),
      ...data,
    }),
  });

  await setLastSentDate(today);
  console.log(`[DailyDigest] Sent to ${recipients.length} recipient(s) for ${today}`);

  await cleanupIntermediatePrintPhotos();
}

// For successful print jobs completed >1 day ago, delete all but the final photo.
// Failed jobs retain all photos for analysis.
async function cleanupIntermediatePrintPhotos(): Promise<void> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const jobs = await prisma.printJob.findMany({
    where: {
      isPrintSuccessful: true,
      printCompletedAt: { lt: yesterday },
      photos: { some: {} },
    },
    include: { photos: { orderBy: { capturedAt: 'asc' } } },
  });

  let totalCleaned = 0;
  const storage = getBlobStorageInstance();
  for (const job of jobs) {
    const toDelete = job.photos.slice(0, -1); // keep only the last photo
    if (toDelete.length === 0) continue;
    for (const photo of toDelete) {
      if (photo.photoPathname) {
        await storage.delete(photo.photoPathname).catch((e) =>
          console.warn(`[DailyDigest] Failed to delete photo blob ${photo.photoPathname}:`, e)
        );
      }
      await prisma.printJobPhoto.delete({ where: { id: photo.id } });
    }
    totalCleaned += toDelete.length;
  }

  if (totalCleaned > 0) {
    console.log(`[DailyDigest] Cleaned up ${totalCleaned} intermediate print bed photo(s)`);
  }
}

export function registerDailyDigestTask(): void {
  registerInternalTask({
    key: TASK_KEY,
    label: 'Daily Digest Email',
    description: `Sends a morning summary email to site alert recipients at hour ${getDigestHour()} (DAILY_DIGEST_HOUR env var). Retries up to ${RETRY_WINDOW_HOURS}h after target if sending fails.`,
    intervalMs: 60 * 60 * 1000, // check every hour
    runOnStartup: true,          // check on server startup in case we missed the window
    task: sendDailyDigest,
  });
}
