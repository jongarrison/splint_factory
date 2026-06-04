import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import MoreInfoRequestEmail from '@/emails/more-info-request';

export interface MoreInfoFormData {
  city: string;
  stateProvince: string;
  country: string;
  phone?: string;
  organization: string;
  medicalSpecialty: string;
  interestedWaitlist: boolean;
  interestedInfo: boolean;
  interestedUpdates: boolean;
  notes?: string;
}

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
    email: string;
  } & MoreInfoFormData;

  const { turnstileToken, name, email, ...rest } = body;

  // Basic field validation
  if (!name?.trim() || !email?.trim() || !rest.city?.trim() || !rest.stateProvince?.trim()
      || !rest.country?.trim() || !rest.organization?.trim() || !rest.medicalSpecialty?.trim()) {
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

  const formData: MoreInfoFormData = {
    city: rest.city.trim(),
    stateProvince: rest.stateProvince.trim(),
    country: rest.country.trim(),
    phone: rest.phone?.trim() || undefined,
    organization: rest.organization.trim(),
    medicalSpecialty: rest.medicalSpecialty.trim(),
    interestedWaitlist: Boolean(rest.interestedWaitlist),
    interestedInfo: Boolean(rest.interestedInfo),
    interestedUpdates: Boolean(rest.interestedUpdates),
    notes: rest.notes?.trim() || undefined,
  };

  // Save to DB
  const record = await prisma.moreInfoRequest.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      data: formData,
    },
  });

  // Email site alert recipients
  const alertRecipients = await prisma.user.findMany({
    where: { role: 'SYSTEM_ADMIN', siteAlertOptIn: true },
    select: { email: true },
  });

  if (alertRecipients.length > 0) {
    const submittedAt = record.createdAt.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    const d = record.data as MoreInfoFormData;
    await sendEmail({
      to: alertRecipients.map(u => u.email).filter((e): e is string => e !== null),
      subject: `New More-Info Request: ${record.name} (${d.organization})`,
      react: MoreInfoRequestEmail({ name: record.name, email: record.email, submittedAt, data: d }),
    });
  }

  return NextResponse.json({ ok: true });
}
