import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

/**
 * Sync NamedGeometry records between environments
 * 
 * Usage:
 * Export from local:
 *   DATABASE_URL="file:./dev.db" npx tsx scripts/sync-geometries.ts export
 * 
 * Import to production:
 *   DATABASE_URL="postgresql://..." DIRECT_URL="postgresql://..." npx tsx scripts/sync-geometries.ts import
 */

interface GeometryExport {
  GeometryName: string;
  GeometryAlgorithmName: string;
  GeometryInputParameterSchema: string;
  shortDescription?: string | null;
  previewImage?: string | null; // Base64 encoded
  previewImageContentType?: string | null;
  measurementImage?: string | null; // Base64 encoded
  measurementImageContentType?: string | null;
}

const EXPORT_FILE = path.join(__dirname, '..', 'geometry-export.json');

async function exportGeometries() {
  console.log('Exporting NamedGeometry records...');
  
  const geometries = await prisma.namedGeometry.findMany({
    where: { isActive: true },
    select: {
      GeometryName: true,
      GeometryAlgorithmName: true,
      GeometryInputParameterSchema: true,
      shortDescription: true,
      previewImage: true,
      previewImageContentType: true,
      measurementImage: true,
      measurementImageContentType: true,
    },
  });

  // Convert Buffer to Base64 for JSON export
  const exportData: GeometryExport[] = geometries.map(g => ({
    ...g,
    previewImage: g.previewImage ? Buffer.from(g.previewImage).toString('base64') : null,
    measurementImage: g.measurementImage ? Buffer.from(g.measurementImage).toString('base64') : null,
  }));

  fs.writeFileSync(EXPORT_FILE, JSON.stringify(exportData, null, 2));
  console.log(`✅ Exported ${exportData.length} geometries to ${EXPORT_FILE}`);
}

async function importGeometries() {
  console.log('Importing NamedGeometry records...');
  
  if (!fs.existsSync(EXPORT_FILE)) {
    console.error('❌ Export file not found. Run export first.');
    process.exit(1);
  }

  const exportData: GeometryExport[] = JSON.parse(fs.readFileSync(EXPORT_FILE, 'utf-8'));
  
  // Get the first system admin user to assign as creator
  const systemAdmin = await prisma.user.findFirst({
    where: { role: 'SYSTEM_ADMIN' },
  });

  if (!systemAdmin) {
    console.error('❌ No SYSTEM_ADMIN user found. Create one first.');
    process.exit(1);
  }

  let imported = 0;
  let skipped = 0;

  for (const geometry of exportData) {
    // Check if geometry already exists
    const existing = await prisma.namedGeometry.findUnique({
      where: { GeometryName: geometry.GeometryName },
    });

    if (existing) {
      console.log(`⏭️  Skipping ${geometry.GeometryName} (already exists)`);
      skipped++;
      continue;
    }

    // Convert Base64 back to Buffer
    await prisma.namedGeometry.create({
      data: {
        GeometryName: geometry.GeometryName,
        GeometryAlgorithmName: geometry.GeometryAlgorithmName,
        GeometryInputParameterSchema: geometry.GeometryInputParameterSchema,
        shortDescription: geometry.shortDescription,
        previewImage: geometry.previewImage ? Buffer.from(geometry.previewImage, 'base64') : null,
        previewImageContentType: geometry.previewImageContentType,
        previewImageUpdatedAt: geometry.previewImage ? new Date() : null,
        measurementImage: geometry.measurementImage ? Buffer.from(geometry.measurementImage, 'base64') : null,
        measurementImageContentType: geometry.measurementImageContentType,
        measurementImageUpdatedAt: geometry.measurementImage ? new Date() : null,
        CreatorID: systemAdmin.id,
        isActive: true,
      },
    });

    console.log(`✅ Imported ${geometry.GeometryName}`);
    imported++;
  }

  console.log(`\n📊 Summary: ${imported} imported, ${skipped} skipped`);
}

async function main() {
  const command = process.argv[2];

  if (command === 'export') {
    await exportGeometries();
  } else if (command === 'import') {
    await importGeometries();
  } else {
    console.log('Usage:');
    console.log('  npx tsx scripts/sync-geometries.ts export');
    console.log('  npx tsx scripts/sync-geometries.ts import');
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
