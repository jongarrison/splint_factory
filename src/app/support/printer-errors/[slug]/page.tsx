import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPrinterErrorArticle } from '@/lib/printer-error-articles';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const article = getPrinterErrorArticle((await params).slug);
  return {
    title: article ? `${article.title} - Splint Factory` : 'Printer Recovery - Splint Factory',
    description: article?.summary,
  };
}

/**
 * Render public, phone-readable recovery guidance for modal QR destinations.
 */
export default async function PrinterErrorArticlePage({ params }: PageProps) {
  const article = getPrinterErrorArticle((await params).slug);
  if (!article) notFound();

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--text-primary)]">
      <article className="mx-auto max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-blue)]">
          Splint Factory Printer Recovery
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{article.title}</h1>
        <p className="mt-3 text-base text-[var(--text-secondary)]">{article.summary}</p>

        <section className="mt-7">
          <h2 className="text-xl font-semibold">Recovery steps</h2>
          <ol className="mt-3 list-decimal space-y-3 pl-6 text-[var(--text-secondary)]">
            {article.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </section>

        <section className="mt-7 rounded-lg bg-[var(--surface-secondary)] p-4">
          <h2 className="text-lg font-semibold">Before printing again</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--text-secondary)]">
            {article.inspect.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <p className="mt-6 rounded-lg border border-[var(--border)] p-4 text-[var(--text-secondary)]">
          {article.supportNote}
        </p>

        {article.video && (
          <p className="mt-6">
            <Link
              href={article.video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-lg bg-[var(--accent-blue)] px-4 py-3 font-semibold text-white"
            >
              {article.video.label}
            </Link>
          </p>
        )}

        <p className="mt-6 text-sm text-[var(--text-muted)]">
          Additional manufacturer information is available from{' '}
          <Link
            href="https://wiki.bambulab.com/"
            className="text-[var(--accent-blue)] underline"
          >
            Bambu Lab documentation
          </Link>.
        </p>
      </article>
    </main>
  );
}
