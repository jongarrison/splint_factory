import Link from 'next/link';
import { notFound } from 'next/navigation';
import Header from '@/components/navigation/Header';
import { getSurveyUser } from '@/lib/design-survey-access';
import { getSurveyQuestions } from '@/lib/design-survey';
import { formatDate } from '@/lib/formatDate';
import { prisma } from '@/lib/prisma';
import ReviewForm from './review-form';

export default async function SurveyResponsePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSurveyUser();
  if (user?.role !== 'SYSTEM_ADMIN') notFound();
  const { id } = await params;
  const response = await prisma.designSurveyResponse.findUnique({
    where: { id },
    include: {
      organization: { select: { name: true } },
      submittedBy: { select: { name: true, email: true } },
      design: { select: { name: true } },
    },
  });
  if (!response) notFound();
  const questions = getSurveyQuestions(response.formVersion);
  const answers = response.answers && typeof response.answers === 'object' && !Array.isArray(response.answers)
    ? response.answers
    : null;

  return (
    <div className="page-shell">
      <Header />
      <main className="page-content max-w-3xl space-y-4">
        <Link href="/admin/design-survey" className="text-link">Back to Splint Design Survey Responses</Link>
        <h1 className="page-title">Splint Design Survey Response</h1>
        <div className="card p-6 space-y-4">
          <p className="text-secondary">
            Submitted by {response.submittedBy.name || response.submittedBy.email} ({response.organization.name})
            {' on '}{formatDate(response.createdAt.toISOString())} (form version {response.formVersion})
          </p>
          <dl className="space-y-4">
            <div><dt className="font-semibold">Splint design</dt><dd>{response.design.name}</dd></div>
            <div><dt className="font-semibold">Object ID</dt><dd>{response.objectId ?? 'Skipped'}</dd></div>
            {questions?.map(question => {
              const value = answers?.[question.id];
              const text = typeof value === 'string' || typeof value === 'number' ? String(value) : null;
              return (
                <div key={question.id}>
                  <dt className="font-semibold">{question.prompt}</dt>
                  <dd className="whitespace-pre-wrap break-words">
                    {text === null ? 'Skipped' : question.kind === 'text'
                      ? text : question.choices.find(choice => choice.value === text)?.label ?? text}
                  </dd>
                </div>
              );
            })}
          </dl>
          {!questions && <p className="alert-error">The questions for this form version are not available.</p>}
        </div>
        <ReviewForm
          key={response.id}
          responseId={response.id}
          isRead={response.isRead}
          note={response.adminNote ?? ''}
          reviewedBy={response.lastReviewedByName}
          reviewedAt={response.lastReviewedAt ? formatDate(response.lastReviewedAt.toISOString()) : null}
        />
      </main>
    </div>
  );
}
