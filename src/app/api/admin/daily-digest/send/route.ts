import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { gatherDigestData, buildAdminUrl } from '@/lib/daily-digest';
import DailyDigestEmail from '@/emails/daily-digest';


// POST /api/admin/daily-digest/send - Immediately send the daily digest (ignores hour/already-sent guards)
export async function POST() {
  const session = await auth();
  if (!session?.user?.role || session.user.role !== 'SYSTEM_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const recipients = await prisma.user.findMany({
    where: { role: 'SYSTEM_ADMIN', siteAlertOptIn: true },
    select: { email: true },
  });

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'No opted-in SYSTEM_ADMIN recipients found.' }, { status: 400 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const data = await gatherDigestData(since);

  const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  await sendEmail({
    to: recipients.map(u => u.email).filter((e): e is string => e !== null),
    subject: `[TEST] Splint Factory daily digest - ${reportDate}`,
    react: DailyDigestEmail({ reportDate, windowHours: 24, adminUrl: buildAdminUrl(), ...data }),
  });

  return NextResponse.json({ recipientCount: recipients.length });
}
