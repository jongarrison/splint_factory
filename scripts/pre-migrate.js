/**
 * Pre-migration script to handle baseline migration in production
 * 
 * This script runs before `prisma migrate deploy` and checks if the baseline
 * migration needs to be marked as applied. It's idempotent and safe to run
 * on every deployment.
 */

const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const BASELINE_MIGRATION = '20260128225659_init';

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Checking migration status...');
    
    // Query the migrations table to see if baseline migration exists
    const existingMigration = await prisma.$queryRaw`
      SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations 
      WHERE migration_name = ${BASELINE_MIGRATION}
    `;
    
    if (existingMigration.length === 0) {
      console.log(`✨ Baseline migration ${BASELINE_MIGRATION} not found in database`);
      console.log('📝 Marking baseline migration as applied...');
      
      // Run prisma migrate resolve to mark it as applied
      execSync(`npx prisma migrate resolve --applied ${BASELINE_MIGRATION}`, {
        stdio: 'inherit',
        env: process.env
      });
      
      console.log('✅ Baseline migration marked as applied');
    } else {
      const migration = existingMigration[0];
      
      // Check if migration is in failed state (started but not finished)
      if (!migration.finished_at && !migration.rolled_back_at) {
        console.log(`⚠️  Baseline migration ${BASELINE_MIGRATION} is in FAILED state`);
        console.log('🔄 Rolling back failed migration...');
        
        // First mark it as rolled back
        execSync(`npx prisma migrate resolve --rolled-back ${BASELINE_MIGRATION}`, {
          stdio: 'inherit',
          env: process.env
        });
        
        console.log('📝 Marking baseline migration as applied...');
        
        // Then mark it as applied
        execSync(`npx prisma migrate resolve --applied ${BASELINE_MIGRATION}`, {
          stdio: 'inherit',
          env: process.env
        });
        
        console.log('✅ Baseline migration recovered and marked as applied');
      } else {
        console.log(`✓ Baseline migration ${BASELINE_MIGRATION} already applied`);
      }
    }
    
    console.log('✅ Pre-migration check complete');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Pre-migration check failed:', error.message);
    
    // If the _prisma_migrations table doesn't exist yet, that's okay
    // This happens on first-ever deployment to a fresh database
    if (error.code === 'P2021' || error.message.includes('_prisma_migrations')) {
      console.log('ℹ️  Migrations table does not exist yet - first deployment detected');
      console.log('✅ Proceeding with normal migration deployment');
      process.exit(0);
    }
    
    // For other errors, exit with error code
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
