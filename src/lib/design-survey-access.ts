import { getActiveDesigns } from '@/designs/registry';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function getSurveyUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, organizationId: true, role: true, name: true, email: true },
  });
}

export async function getSurveyDesigns(organizationId: string) {
  const assignments = await prisma.organizationDesign.findMany({
    where: { organizationId },
    select: { designId: true },
  });
  const assignedIds = new Set(assignments.map(({ designId }) => designId));
  return getActiveDesigns()
    .filter(design => design.category === 'splint' && assignedIds.has(design.id))
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
