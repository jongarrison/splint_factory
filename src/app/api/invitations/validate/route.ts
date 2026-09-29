import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")

  if (!token) {
    return NextResponse.json({ error: "Invitation token is required" }, { status: 400 })
  }

  const invitation = await prisma.invitationLink.findUnique({
    where: {
      token,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      email: true,
      organization: { select: { name: true } },
    },
  })

  if (!invitation) {
    return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 })
  }

  return NextResponse.json(
    {
      email: invitation.email,
      organizationName: invitation.organization.name,
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}