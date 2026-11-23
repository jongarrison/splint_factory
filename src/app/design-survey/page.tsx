import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';
import { getSurveyDesigns, getSurveyUser } from '@/lib/design-survey-access';
import { prisma } from '@/lib/prisma';
import SurveyForm from './survey-form';

export default async function DesignSurveyPage({
  searchParams,
}: { searchParams: Promise<{ job?: string | string[] }> }) {
  const { job: jobId } = await searchParams;
  const user = await getSurveyUser();
  const organizationId = user?.organizationId;
  const designs = organizationId ? await getSurveyDesigns(organizationId) : [];
  const job = organizationId && typeof jobId === 'string'
    ? await prisma.designJob.findFirst({
      where: { id: jobId, owningOrganizationId: organizationId },
      select: { id: true, designId: true, objectId: true },
    })
    : null;
  if (organizationId && jobId !== undefined && !job) notFound();
  const canPrefill = job && designs.some(design => design.id === job.designId);

  return (
    <div className="page-shell">
      <Header />
      <main className="page-content max-w-2xl space-y-4">
        <h1 className="page-title">Splint Design Survey</h1>
        <p className="text-secondary">Help us improve splint fit, design, and print quality.</p>
        {!organizationId ? (
          <p className="card p-4">An organization account is required to submit feedback.</p>
        ) : designs.length === 0 ? (
          <p className="card p-4">Your organization has no available splint designs to review.</p>
        ) : job && !canPrefill ? (
          <div className="card p-4 space-y-2">
            <p>This job&apos;s design is not available for feedback.</p>
            <Link href="/design-survey" className="text-link">Open a blank survey</Link>
          </div>
        ) : (
          <SurveyForm
            key={job?.id ?? 'standalone'}
            designs={designs}
            submissionKey={randomUUID()}
            initialDesignId={job?.designId ?? ''}
            initialObjectId={job?.objectId ?? ''}
          />
        )}
      </main>
    </div>
  );
}
