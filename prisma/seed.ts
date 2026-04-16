import { PrismaClient } from '@prisma/client'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

// Load all design definitions from src/designs/*/definition.json
function loadDesignDefinitions() {
  const designsDir = join(__dirname, '..', 'src', 'designs')
  const entries = readdirSync(designsDir)
  const definitions: Array<{
    id: string
    name: string
    algorithmName: string
    shortDescription: string | null
    isActive: boolean
    inputParameters: unknown[]
  }> = []

  for (const entry of entries) {
    const defPath = join(designsDir, entry, 'definition.json')
    try {
      if (statSync(defPath).isFile()) {
        const raw = JSON.parse(readFileSync(defPath, 'utf-8'))
        definitions.push({
          id: raw.id,
          name: raw.name,
          algorithmName: raw.algorithmName,
          shortDescription: raw.shortDescription ?? null,
          isActive: raw.isActive,
          inputParameters: raw.inputParameters,
        })
      }
    } catch {
      // skip directories without definition.json
    }
  }
  return definitions
}

async function syncDesigns() {
  const definitions = loadDesignDefinitions()
  console.log(`Syncing ${definitions.length} design definitions...`)

  for (const def of definitions) {
    await prisma.design.upsert({
      where: { id: def.id },
      update: {
        name: def.name,
        algorithmName: def.algorithmName,
        shortDescription: def.shortDescription,
        isActive: def.isActive,
      },
      create: {
        id: def.id,
        name: def.name,
        algorithmName: def.algorithmName,
        shortDescription: def.shortDescription,
        isActive: def.isActive,
      },
    })
    console.log(`  Synced: ${def.name}`)
  }
}

async function main() {
  console.log('Seeding database...')

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
  console.log('Created System Administration organization:', systemOrg.name)

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
  console.log('Created Default Organization:', defaultOrg.name)

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
    console.log(`  Assigned ${usersWithoutOrg.length} existing users to Default Organization`)
  }

  // Sync design definitions from code to DB
  await syncDesigns()

  console.log('Seeding completed!')
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
