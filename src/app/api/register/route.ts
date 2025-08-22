import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, invitationToken } = await request.json()

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      )
    }

    // If invitation token provided, validate it
    let invitationData = null
    if (invitationToken) {
      invitationData = await prisma.invitationLink.findUnique({
        where: { 
          token: invitationToken,
          usedAt: null, // Not used yet
          expiresAt: { gt: new Date() } // Not expired
        },
        include: { organization: true }
      })

      if (!invitationData) {
        return NextResponse.json(
          { error: "Invalid or expired invitation" },
          { status: 400 }
        )
      }

      // If invitation has a specific email, validate it matches
      if (invitationData.email && invitationData.email !== email) {
        return NextResponse.json(
          { error: "Invitation is for a different email address" },
          { status: 400 }
        )
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user with organization association if invitation exists
    const baseUserData = {
      name,
      email,
      password: hashedPassword,
    }

    const userData = invitationData ? {
      ...baseUserData,
      organizationId: invitationData.organizationId,
      role: UserRole.MEMBER,
      invitedByUserId: invitationData.createdByUserId,
      invitationAcceptedAt: new Date()
    } : baseUserData

    const user = await prisma.user.create({
      data: userData,
    })

    // If invitation was used, mark it as used
    if (invitationData) {
      await prisma.invitationLink.update({
        where: { id: invitationData.id },
        data: {
          usedAt: new Date(),
          usedByUserId: user.id
        }
      })
    }

    // Remove password from response
    const { password: _password, ...userWithoutPassword } = user
    
    // Suppress unused variable warning - _password is intentionally unused
    void _password

    return NextResponse.json(
      { message: "User created successfully", user: userWithoutPassword },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
