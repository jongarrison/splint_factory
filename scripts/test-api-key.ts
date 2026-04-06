import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const testKey = process.argv[2];
if (!testKey) {
  console.log('Usage: npx tsx scripts/test-api-key.ts <your-api-key>');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const keys = await prisma.apiKey.findMany({
    where: { isActive: true },
    select: { id: true, name: true, keyHash: true }
  });
  
  console.log(`Found ${keys.length} active API key(s)`);
  
  for (const key of keys) {
    console.log(`\nChecking against: ${key.name}`);
    console.log(`Hash: ${key.keyHash}`);
    console.log(`Test key length: ${testKey.length}`);
    const match = await bcrypt.compare(testKey, key.keyHash);
    console.log(`Match: ${match}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
