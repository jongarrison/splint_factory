import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, password: true },
    take: 5,
  });
  for (const u of users) {
    console.log(`${u.email} | has_password=${!!u.password} | pw_len=${u.password?.length ?? 0}`);
  }
  console.log(`Total users: ${await prisma.user.count()}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
