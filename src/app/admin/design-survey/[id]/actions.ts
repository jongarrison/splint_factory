'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { ADMIN_NOTE_MAX_LENGTH } from '@/lib/design-survey';
import { getSurveyUser } from '@/lib/design-survey-access';
import { prisma } from '@/lib/prisma';

export type ReviewState = { error?: string; saved?: boolean };

export async function saveSurveyReview(responseId: string, _previous: ReviewState, data: FormData): Promise<ReviewState> {
  try {
    const admin = await getSurveyUser();
    if (admin?.role !== 'SYSTEM_ADMIN') return { error: 'Only System Admins can save reviews.' };

    const note = data.get('note');
    const read = data.get('isRead');
    if (typeof note !== 'string' || note.trim().length > ADMIN_NOTE_MAX_LENGTH || note.includes('\0')) {
      return { error: `Enter a valid note of at most ${ADMIN_NOTE_MAX_LENGTH} characters.` };
    }
    if (read !== null && read !== 'on') return { error: 'The read status is invalid.' };

    await prisma.designSurveyResponse.update({
      where: { id: responseId },
      data: {
        isRead: read === 'on',
        adminNote: note.trim() || null,
        lastReviewedByUserId: admin.id,
        lastReviewedByName: admin.name?.trim() || admin.email,
        lastReviewedAt: new Date(),
      },
      select: { id: true },
    });
    revalidatePath('/admin/design-survey');
    revalidatePath(`/admin/design-survey/${responseId}`);
    return { saved: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return { error: 'This survey response no longer exists.' };
    }
    console.error('Design survey review failed', error instanceof Prisma.PrismaClientKnownRequestError ? error.code : '');
    return { error: 'The review could not be saved. Please try again.' };
  }
}
