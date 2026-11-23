import Link from 'next/link';
import { notFound } from 'next/navigation';
import Header from '@/components/navigation/Header';
import { getSurveyUser } from '@/lib/design-survey-access';
import { formatDate } from '@/lib/formatDate';
import { prisma } from '@/lib/prisma';

const PAGE_SIZE = 50;

export default async function SurveyResponsesPage({
  searchParams,
}: { searchParams: Promise<{ after?: string }> }) {
  const user = await getSurveyUser();
  if (user?.role !== 'SYSTEM_ADMIN') notFound();
  const { after } = await searchParams;
  const responses = await prisma.designSurveyResponse.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(typeof after === 'string' && after ? { cursor: { id: after }, skip: 1 } : {}),
    take: PAGE_SIZE + 1,
    select: {
      id: true, createdAt: true, isRead: true,
      organization: { select: { name: true } },
      submittedBy: { select: { name: true, email: true } },
      design: { select: { name: true } },
    },
  });
  const visible = responses.slice(0, PAGE_SIZE);
  const next = responses.length > PAGE_SIZE ? visible.at(-1)?.id : undefined;

  return (
    <div className="page-shell">
      <Header />
      <main className="page-content space-y-4">
        <h1 className="page-title">Splint Design Survey Responses</h1>
        {visible.length === 0 ? <p className="card p-4">No responses to show.</p> : (
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  {['Submitted', 'Organization', 'Submitter', 'Splint design', 'Status'].map(label => (
                    <th key={label} scope="col" className="p-3">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(response => (
                  <tr key={response.id} className="border-b border-[var(--border)]">
                    <td className="p-3">
                      <Link href={`/admin/design-survey/${response.id}`} className="text-link">
                        {formatDate(response.createdAt.toISOString())}
                      </Link>
                    </td>
                    <td className="p-3">{response.organization.name}</td>
                    <td className="p-3">{response.submittedBy.name || response.submittedBy.email}</td>
                    <td className="p-3">{response.design.name}</td>
                    <td className="p-3">{response.isRead ? 'Read' : 'Unread'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <nav aria-label="Response pages" className="flex gap-4">
          {after && <Link href="/admin/design-survey" className="text-link">Newest responses</Link>}
          {next && <Link href={`/admin/design-survey?after=${encodeURIComponent(next)}`} className="text-link">Older responses</Link>}
        </nav>
      </main>
    </div>
  );
}
