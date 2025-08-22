import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/users - List users with role-based filtering
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user with organization and role
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let users;

    // System admins can see all users across all organizations
    if (currentUser.role === 'SYSTEM_ADMIN') {
      users = await prisma.user.findMany({
        include: {
          organization: { select: { id: true, name: true } },
          invitedBy: { select: { id: true, name: true, email: true } }
        },
        orderBy: [
          { organization: { name: 'asc' } },
          { role: 'asc' },
          { name: 'asc' }
        ]
      })
    } else {
      // Org admins and members can only see users in their organization
      if (!currentUser.organizationId) {
        return NextResponse.json({ error: 'User not assigned to organization' }, { status: 400 })
      }

      users = await prisma.user.findMany({
        where: { organizationId: currentUser.organizationId },
        include: {
          organization: { select: { id: true, name: true } },
          invitedBy: { select: { id: true, name: true, email: true } }
        },
        orderBy: [
          { role: 'asc' },
          { name: 'asc' }
        ]
      })
    }

    return NextResponse.json(users)
  } catch (error) {
    console.error('Failed to fetch users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

// PATCH /api/users - Update user role or organization
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, role, organizationId } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Get current user with permissions
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'Current user not found' }, { status: 404 })
    }

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Permission checks
    if (currentUser.role === 'MEMBER') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // ORG_ADMIN can only modify users in their organization
    if (currentUser.role === 'ORG_ADMIN') {
      if (currentUser.organizationId !== targetUser.organizationId) {
        return NextResponse.json({ 
          error: 'Cannot modify users from other organizations' 
        }, { status: 403 })
      }
      
      // ORG_ADMIN cannot promote users to SYSTEM_ADMIN
      if (role === 'SYSTEM_ADMIN') {
        return NextResponse.json({ 
          error: 'Cannot promote users to System Admin role' 
        }, { status: 403 })
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    
    if (role !== undefined) {
      updateData.role = role
    }
    
    if (organizationId !== undefined) {
      if (organizationId === null || organizationId === '') {
        updateData.organizationId = null
      } else {
        updateData.organizationId = organizationId
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        organization: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, name: true, email: true } }
      }
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Failed to update user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}
