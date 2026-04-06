import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const tables = [
    ['User', prisma.user.count()],
    ['Organization', prisma.organization.count()],
    ['Design', prisma.design.count()],
    ['DesignJob', prisma.designJob.count()],
    ['PrintJob', prisma.printJob.count()],
    ['ClientDevice', prisma.clientDevice.count()],
    ['ApiKey', prisma.apiKey.count()],
    ['Link', prisma.link.count()],
    ['AuditEvent', prisma.auditEvent.count()],
    ['InvitationLink', prisma.invitationLink.count()],
  ] as const;
  for (const [name, promise] of tables) {
    try {
      const count = await promise;
      console.log(`${name}: ${count}`);
    } catch (e: any) {
      console.log(`${name}: ERROR - ${e.message?.slice(0, 80)}`);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
