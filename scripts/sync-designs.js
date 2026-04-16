/**
 * Sync design definitions from code to database.
 * Runs as part of the Vercel build pipeline after prisma generate.
 * Plain JS so it doesn't need tsx.
 */

const { PrismaClient } = require('@prisma/client');
const { readFileSync, readdirSync, statSync } = require('fs');
const { join } = require('path');

async function main() {
  const prisma = new PrismaClient();
  const designsDir = join(__dirname, '..', 'src', 'designs');

  try {
    const entries = readdirSync(designsDir);
    const definitions = [];

    for (const entry of entries) {
      const defPath = join(designsDir, entry, 'definition.json');
      try {
        if (statSync(defPath).isFile()) {
          const raw = JSON.parse(readFileSync(defPath, 'utf-8'));
          definitions.push(raw);
        }
      } catch {
        // skip entries without definition.json
      }
    }

    console.log(`Syncing ${definitions.length} design definitions to database...`);

    for (const def of definitions) {
      await prisma.design.upsert({
        where: { id: def.id },
        update: {
          name: def.name,
          algorithmName: def.algorithmName,
          shortDescription: def.shortDescription || null,
          isActive: def.isActive,
        },
        create: {
          id: def.id,
          name: def.name,
          algorithmName: def.algorithmName,
          shortDescription: def.shortDescription || null,
          isActive: def.isActive,
        },
      });
      console.log(`  Synced: ${def.name}`);
    }

    console.log('Design sync complete.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Design sync failed:', err);
  process.exit(1);
});
