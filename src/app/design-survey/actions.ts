'use server';

import { Prisma } from '@prisma/client';
import { getSurveyDesigns, getSurveyUser } from '@/lib/design-survey-access';
import { OBJECT_ID_MAX_LENGTH, readSurveyAnswers } from '@/lib/design-survey';
import { prisma } from '@/lib/prisma';

export type SurveyState = { error?: string; field?: string; saved?: boolean };

export async function submitDesignSurvey(_previous: SurveyState, data: FormData): Promise<SurveyState> {
  const submissionKey = data.get('submissionKey');
  const version = data.get('formVersion');
  const designId = data.get('designId');
  const rawObjectId = data.get('objectId');

  try {
    const user = await getSurveyUser();
    if (!user?.organizationId) return { error: 'Sign in with an organization account to submit feedback.' };
    const organizationId = user.organizationId;
    if (typeof submissionKey !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(submissionKey)) {
      return { error: 'This survey could not be identified. Reopen the survey and try again.' };
    }
    if (typeof designId !== 'string' || !designId) return { error: 'Select a splint design.', field: 'designId' };
    if (typeof rawObjectId !== 'string' || rawObjectId.trim().length > OBJECT_ID_MAX_LENGTH || rawObjectId.includes('\0')) {
      return { error: `Enter a valid Object ID of at most ${OBJECT_ID_MAX_LENGTH} characters.`, field: 'objectId' };
    }
    const objectId = rawObjectId.trim() || null;
    const formVersion = typeof version === 'string' && /^\d+$/.test(version) ? Number(version) : 0;
    const result = readSurveyAnswers(formVersion, data);
    if ('error' in result) return result;
    const { answers } = result;
    const submittedByUserId = user.id;
    const where = { submittedByUserId_submissionKey: { submittedByUserId, submissionKey } };

    async function checkSaved(): Promise<SurveyState | undefined> {
      const saved = await prisma.designSurveyResponse.findUnique({
        where,
        select: { designId: true, objectId: true, formVersion: true, answers: true, organizationId: true },
      });
      if (!saved) return;
      const previous = saved.answers;
      const sameAnswers = previous && typeof previous === 'object' && !Array.isArray(previous)
        && Object.keys(previous).length === Object.keys(answers).length
        && Object.entries(answers).every(([key, value]) => previous[key] === value);
      if (sameAnswers && saved.organizationId === organizationId && saved.designId === designId
        && saved.objectId === objectId && saved.formVersion === formVersion) {
        return { saved: true };
      }
      return { error: 'A different response was already saved from this form. Open a new survey to send more feedback.' };
    }

    const existing = await checkSaved();
    if (existing) return existing;
    const designs = await getSurveyDesigns(organizationId);
    if (!designs.some(design => design.id === designId)) {
      return { error: 'That splint design is not available to your organization.', field: 'designId' };
    }

    try {
      await prisma.designSurveyResponse.create({
        data: { submittedByUserId, organizationId, submissionKey, designId, objectId, formVersion, answers },
        select: { id: true },
      });
      return { saved: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const saved = await checkSaved();
        if (saved) return saved;
      }
      throw error;
    }
  } catch (error) {
    // Do not log Prisma's message: it can include survey answers.
    console.error('Design survey submission failed', error instanceof Prisma.PrismaClientKnownRequestError ? error.code : '');
    return { error: 'Your feedback could not be saved. Please try again.' };
  }
}
