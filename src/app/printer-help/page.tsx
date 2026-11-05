'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Header from '@/components/navigation/Header';
import { getPrinterErrorArticles } from '@/lib/printer-error-articles';

const articles = getPrinterErrorArticles();

/**
 * Give every authenticated operator one stable entry point to printer recovery guidance.
 */
export default function PrinterHelpPage() {
  const [isElectronClient, setIsElectronClient] = useState(false);

  useEffect(() => {
    setIsElectronClient(Boolean(window.electronAPI));
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      <Header variant={isElectronClient ? 'electron' : 'browser'} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-blue)]">
            Printer Operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Printer Help</h1>
          <p className="mt-3 text-[var(--text-secondary)]">
            Recovery procedures for common printer errors, safe restarts, and printer network access.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/support/printer-errors/${article.slug}`}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition-colors hover:bg-[var(--surface-secondary)]"
            >
              <h2 className="text-lg font-semibold">{article.title}</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{article.summary}</p>
              <p className="mt-4 text-sm font-semibold text-[var(--accent-blue)]">
                View recovery procedure
              </p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
