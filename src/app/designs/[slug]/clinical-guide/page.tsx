import { readFile } from 'fs/promises';
import { join } from 'path';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Header from '@/components/navigation/Header';
import { getDesignBySlug } from '@/designs/registry';

// Server-rendered clinical guide page.
// Reads src/designs/<slug>/clinical-guide.md at request time and renders it
// with GFM support (tables, task lists). Middleware enforces auth.

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ClinicalGuidePage({ params }: PageProps) {
  const { slug } = await params;
  const design = getDesignBySlug(slug);

  if (!design || !design.hasClinicalGuide) {
    notFound();
  }

  const filePath = join(process.cwd(), 'src', 'designs', slug, 'clinical-guide.md');
  const markdown = await readFile(filePath, 'utf-8');

  return (
    <div className="page-shell" data-testid="clinical-guide-page">
      <Header variant="browser" />

      <div className="page-content">
        <div className="mb-6">
          <Link
            href={`/design-jobs/new?designId=${design.id}`}
            className="text-link text-sm"
          >
            &larr; Back to {design.name}
          </Link>
        </div>

        <article className="card shadow">
          <div className="card-body prose-clinical">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdown}
            </ReactMarkdown>
          </div>
        </article>
      </div>
    </div>
  );
}
