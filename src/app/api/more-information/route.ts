import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import MoreInfoRequestEmail from '@/emails/more-info-request';

// Verify Cloudflare Turnstile token server-side
async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn('[MoreInfo] TURNSTILE_SECRET_KEY not set — skipping captcha verification in dev');
    return true;
  }

  const formData = new URLSearchParams();
  formData.append('secret', secret);
  formData.append('response', token);
  if (ip) formData.append('remoteip', ip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });

  const data = await res.json() as { success: boolean };
  return data.success === true;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    turnstileToken: string;
    name: string;
    city: string;
    stateProvince: string;
    country: string;
    email: string;
    phone?: string;
    organization: string;
    medicalSpecialty: string;
    interestedWaitlist: boolean;
    interestedInfo: boolean;
    interestedUpdates: boolean;
  };

  const {
    turnstileToken,
    name,
    city,
    stateProvince,
    country,
    email,
    phone,
    organization,
    medicalSpecialty,
    interestedWaitlist,
    interestedInfo,
    interestedUpdates,
  } = body;

  // Basic field validation
  if (!name?.trim() || !city?.trim() || !stateProvince?.trim() || !country?.trim()
      || !email?.trim() || !organization?.trim() || !medicalSpecialty?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Email format sanity check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  if (!turnstileToken) {
    return NextResponse.json({ error: 'Captcha verification required' }, { status: 400 });
  }

  // Verify captcha
  const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for');
  const captchaOk = await verifyTurnstile(turnstileToken, ip);
  if (!captchaOk) {
    return NextResponse.json({ error: 'Captcha verification failed' }, { status: 400 });
  }

  // Save to DB
  const record = await prisma.moreInfoRequest.create({
    data: {
      name: name.trim(),
      city: city.trim(),
      stateProvince: stateProvince.trim(),
      country: country.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      organization: organization.trim(),
      medicalSpecialty: medicalSpecialty.trim(),
      interestedWaitlist: Boolean(interestedWaitlist),
      interestedInfo: Boolean(interestedInfo),
      interestedUpdates: Boolean(interestedUpdates),
    },
  });

  // Email site alert recipients
  const alertRecipients = await prisma.user.findMany({
    where: { role: 'SYSTEM_ADMIN', siteAlertOptIn: true },
    select: { email: true },
  });

  if (alertRecipients.length > 0) {
    const submittedAt = record.createdAt.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    await sendEmail({
      to: alertRecipients.map(u => u.email).filter((e): e is string => e !== null),
      subject: `New More-Info Request: ${name} (${organization})`,
      react: MoreInfoRequestEmail({
        name: record.name,
        city: record.city,
        stateProvince: record.stateProvince,
        country: record.country,
        email: record.email,
        phone: record.phone ?? undefined,
        organization: record.organization,
        medicalSpecialty: record.medicalSpecialty,
        interestedWaitlist: record.interestedWaitlist,
        interestedInfo: record.interestedInfo,
        interestedUpdates: record.interestedUpdates,
        submittedAt,
      }),
    });
  }

  return NextResponse.json({ ok: true });
}
