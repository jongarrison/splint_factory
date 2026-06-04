import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { type MoreInfoFormData } from '@/app/api/more-information/route';

// GET /api/admin/more-info-requests — returns last 30 days of submissions
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'SYSTEM_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const records = await prisma.moreInfoRequest.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, data: true, createdAt: true },
  });

  return NextResponse.json(records);
}

// GET /api/admin/more-info-requests?format=csv — download all records as CSV
export async function POST() {
  // POST with no body = export all as CSV
  const session = await auth();
  if (!session?.user || session.user.role !== 'SYSTEM_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const records = await prisma.moreInfoRequest.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, data: true, createdAt: true },
  });

  const headers = [
    'ID', 'Name', 'Email', 'Organization', 'Medical Specialty',
    'City', 'State/Province', 'Country', 'Phone',
    'Waitlist', 'Info', 'Updates', 'Notes', 'Submitted At',
  ];

  const escape = (val: unknown) => {
    const s = val == null ? '' : String(val);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const rows = records.map(r => {
    const d = r.data as MoreInfoFormData;
    return [
      r.id, r.name, r.email,
      d.organization, d.medicalSpecialty,
      d.city, d.stateProvince, d.country, d.phone ?? '',
      d.interestedWaitlist ? 'Yes' : 'No',
      d.interestedInfo ? 'Yes' : 'No',
      d.interestedUpdates ? 'Yes' : 'No',
      d.notes ?? '',
      r.createdAt.toISOString(),
    ].map(escape).join(',');
  });

  const csv = [headers.map(escape).join(','), ...rows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="more-info-requests-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
