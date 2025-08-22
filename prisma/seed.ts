import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create System Administration organization
  const systemOrg = await prisma.organization.upsert({
    where: { name: 'System Administration' },
    update: {},
    create: {
      name: 'System Administration',
      description: 'System administrators organization for platform management',
      isActive: true,
    },
  })
  console.log('✅ Created System Administration organization:', systemOrg.name)

  // Create Default Organization for regular users
  const defaultOrg = await prisma.organization.upsert({
    where: { name: 'Default Organization' },
    update: {},
    create: {
      name: 'Default Organization',
      description: 'Default organization for users without specific organization assignment',
      isActive: true,
    },
  })
  console.log('✅ Created Default Organization:', defaultOrg.name)

  // Update any existing users without organization to default org
  const usersWithoutOrg = await prisma.user.findMany({
    where: { organizationId: null }
  })
  
  if (usersWithoutOrg.length > 0) {
    await prisma.user.updateMany({
      where: { organizationId: null },
      data: { 
        organizationId: defaultOrg.id,
        role: 'MEMBER' 
      }
    })
    console.log(`✅ Assigned ${usersWithoutOrg.length} existing users to Default Organization`)
  }

  console.log('🎉 Seeding completed!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
