import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'system_settings' },
    select: {
      conferenceRegistrationEnabled: true,
      conferenceOrganization: { select: { isActive: true } },
    },
  })

  const registrationEnabled = Boolean(
    settings?.conferenceRegistrationEnabled && settings.conferenceOrganization?.isActive
  )

  return NextResponse.json({ registrationEnabled })
}