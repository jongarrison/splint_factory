'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '@/components/navigation/Header';
import ImagePlaceholder from '@/components/ImagePlaceholder';
import { getPrinterErrorArticles } from '@/lib/printer-error-articles';

interface Design {
  id: string;
  name: string;
  shortDescription: string | null;
  slug: string;
  hasPreviewImage: boolean;
  hasMeasurementImage: boolean;
  hasClinicalGuide: boolean;
  category: 'splint' | 'tool';
}

const clinicalSynopses: Record<string, string> = {
  'buddy-rings-duo':
    'Provides lateral stabilization or active-assisted motion for two adjacent fingers. It can be used for step-down fracture care, intrinsic sprains, and selected exercise or yoke applications.',
  'infinity-extend':
    'Supports the PIP joint in extension for conditions such as trigger finger and boutonniere deformity while maintaining alignment for healing and function.',
  'infinity-flex':
    'Limits PIP hyperextension for joint instability, hypermobility, OA, or RA. An optional slit can help the splint pass over an enlarged joint.',
  'relative-motion':
    'Positions one or more fingers in relative flexion or extension to support tendon repair, extensor lag, sagittal band injury, intrinsic sprain, and other selected indications.',
};

const printerHelpArticles = getPrinterErrorArticles();

const sectionLinks = [
  { href: '#choose-design', label: '1. Choose a design' },
  { href: '#measurements', label: '2. Enter measurements' },
  { href: '#print-queue', label: '3. Print on Splintbot' },
  { href: '#build-plate', label: '4. Clean the build plate' },
  { href: '#troubleshooting', label: 'Troubleshooting' },
];

export default function TutorialPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isElectronClient, setIsElectronClient] = useState(false);

  useEffect(() => {
    setIsElectronClient(Boolean(window.electronAPI));
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session?.user) {
      router.push('/login');
      return;
    }

    const loadDesigns = async () => {
      try {
        const response = await fetch('/api/designs?activeOnly=true');
        if (!response.ok) {
          throw new Error('Unable to load your organization\'s splint designs.');
        }

        const result = (await response.json()) as Design[];
        setDesigns(result.filter((design) => design.category === 'splint'));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load splint designs.');
      } finally {
        setLoading(false);
      }
    };

    void loadDesigns();
  }, [router, session, status]);

  if (status === 'loading' || loading) {
    return (
      <div className="page-shell">
        <Header variant={isElectronClient ? 'electron' : 'browser'} />
        <main className="page-content">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--accent-blue)]" />
            <p className="mt-4 text-secondary">Loading tutorial...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell" data-testid="tutorial-page">
      <Header variant={isElectronClient ? 'electron' : 'browser'} />

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav
              aria-label="Tutorial sections"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">On this page</p>
              <ol className="mt-3 space-y-2">
                {sectionLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={`/tutorial${link.href}`}
                      className="block rounded-md px-2 py-1.5 text-sm text-secondary transition-colors hover:bg-[var(--surface-secondary)] hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <article className="min-w-0">
            <header className="border-b border-[var(--border)] pb-8">
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-blue)]">
                Getting Started
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-primary sm:text-4xl">
                Make and print a custom splint
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-secondary">
                This guide follows one splint from design selection through measurement, processing,
                printing, and basic printer care.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/design-menu" className="btn-primary px-4 py-2 text-sm">
                  Open Design Menu
                </Link>
                <Link href="/print-queue" className="btn-neutral px-4 py-2 text-sm">
                  Open Print Queue
                </Link>
              </div>
            </header>

            <section id="choose-design" className="scroll-mt-24 border-b border-[var(--border)] py-10">
              <SectionHeading
                number="1"
                title="Choose a splint from the Design Menu"
                description="The Design Menu shows only the active splints available to your organization. Choose the design that matches the clinical goal, then review its guide before taking measurements."
              />

              {error && (
                <div className="mt-6 alert-error" role="alert">
                  {error}
                </div>
              )}

              {!error && designs.length === 0 && (
                <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-secondary">
                  No splint designs are currently available to your organization.
                </div>
              )}

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {designs.map((design) => (
                  <div
                    key={design.id}
                    className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"
                  >
                    <div className="relative aspect-[4/3] bg-[var(--surface-secondary)]">
                      {design.hasPreviewImage ? (
                        <Image
                          src={`/designs/${design.slug}/preview.png`}
                          alt={`${design.name} splint`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <ImagePlaceholder className="h-full w-full" />
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="text-xl font-semibold text-primary">{design.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-secondary">
                        {clinicalSynopses[design.slug] ||
                          design.shortDescription ||
                          'Review this design with your clinical lead before use.'}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
                        <Link
                          href={`/design-jobs/new?designId=${design.id}`}
                          className="text-link"
                        >
                          Choose this design
                        </Link>
                        {design.hasClinicalGuide && (
                          <Link
                            href={`/designs/${design.slug}/clinical-guide`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-link"
                          >
                            Full clinical guide
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Callout title="Clinical responsibility">
                Confirm that the selected design, positioning goal, and patient instructions are
                appropriate for the patient. The tutorial explains the software workflow; it does
                not replace clinical judgment or the design-specific clinical guide.
              </Callout>
            </section>

            <section id="measurements" className="scroll-mt-24 border-b border-[var(--border)] py-10">
              <SectionHeading
                number="2"
                title="Enter the design measurements"
                description="After selecting a design, the New Job page shows that design's measurement guide and only the fields required to generate it."
              />

              <ol className="mt-6 grid gap-4 sm:grid-cols-2">
                <StepCard
                  number="1"
                  title="Open the measurement guide"
                  text="Use the diagram at the top of the page to locate each measurement. Open the full clinical guide when you need design-specific technique or fitting guidance."
                />
                <StepCard
                  number="2"
                  title="Measure in millimeters"
                  text="Follow each field label carefully. Circumference location, tension, finger selection, and offset direction can change the generated fit."
                />
                <StepCard
                  number="3"
                  title="Add a safe queue label"
                  text="Use the optional Print Queue Label to recognize the job at the printer. Do not enter a patient name, date of birth, or other identifying information."
                />
                <StepCard
                  number="4"
                  title="Create the job"
                  text="Correct any highlighted fields, then select Create Job. Geometry generation and slicing run automatically before the print appears in the queue."
                />
              </ol>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {designs
                  .filter((design) => design.hasMeasurementImage)
                  .map((design) => (
                    <figure
                      key={design.id}
                      className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"
                    >
                      <Image
                        src={`/designs/${design.slug}/measurement.png`}
                        alt={`${design.name} measurement diagram`}
                        width={800}
                        height={600}
                        className="h-auto w-full"
                        unoptimized
                      />
                      <figcaption className="border-t border-[var(--border)] px-4 py-3 text-sm text-secondary">
                        {design.name} measurement guide
                      </figcaption>
                    </figure>
                  ))}
              </div>

              <Callout title="Before submitting">
                Recheck every value against the patient and the diagram. A valid number can still be
                the wrong anatomical measurement, so units and measurement location matter.
              </Callout>
            </section>

            <section id="print-queue" className="scroll-mt-24 border-b border-[var(--border)] py-10">
              <SectionHeading
                number="3"
                title="Print from the Splintbot Print Queue"
                description="Splintbot is the touchscreen beside the printer. It displays the same Print Queue as the web app, with local printer controls enabled."
              />

              <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <ol className="space-y-5">
                  <QueueStep
                    number="1"
                    title="Wait for the job to become ready"
                    text="The job appears in the Active queue after geometry processing and slicing finish. Use Refresh if you do not see a recently submitted job."
                  />
                  <QueueStep
                    number="2"
                    title="Match the job"
                    text="Confirm the queue label, design name, and Object ID before printing. The Print button is enabled only on Splintbot when the print file and printer are ready."
                  />
                  <QueueStep
                    number="3"
                    title="Prepare the printer"
                    text="Remove the previous print, clean and reseat the build plate, and confirm that no loose material remains around the plate or nozzle."
                  />
                  <QueueStep
                    number="4"
                    title="Select Print and confirm"
                    text="Start only one job. Splintbot uploads the print file and displays printer preparation and progress; wait for the printer to begin before leaving it."
                  />
                  <QueueStep
                    number="5"
                    title="Inspect the first layer"
                    text="Confirm that the first layer adheres evenly. If material lifts, strings, or collects on the nozzle, stop the print and follow the Printer Help guidance."
                  />
                  <QueueStep
                    number="6"
                    title="Finish and review"
                    text="Let the plate cool, remove the splint, and remove skirt or brim material. Use Review Print in the queue to record print and design quality."
                  />
                </ol>
              </div>

              <Callout title="Print controls are local">
                You can view the queue from a browser, but the Print button works only on the
                Splintbot connected to that printer.
              </Callout>
            </section>

            <section id="build-plate" className="scroll-mt-24 border-b border-[var(--border)] py-10">
              <SectionHeading
                number="4"
                title="Keep the build plate clean"
                description="A clean, correctly seated plate is the most important routine step for reliable first-layer adhesion."
              />

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <h3 className="text-lg font-semibold text-primary">Between prints</h3>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-secondary">
                    <ChecklistItem>Wait for the plate and printed part to cool.</ChecklistItem>
                    <ChecklistItem>Remove the plate by its edges and flex it gently to release the print.</ChecklistItem>
                    <ChecklistItem>Remove every piece of skirt, brim, and loose filament.</ChecklistItem>
                    <ChecklistItem>Avoid touching the printable surface with bare fingers.</ChecklistItem>
                    <ChecklistItem>Reinstall the plate flat against both rear alignment points.</ChecklistItem>
                  </ul>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <h3 className="text-lg font-semibold text-primary">When adhesion decreases</h3>
                  <ol className="mt-4 space-y-3 text-sm leading-6 text-secondary">
                    <ChecklistItem>Remove the cool plate from the printer.</ChecklistItem>
                    <ChecklistItem>Wash the print surface with warm water and plain dish soap using a clean, soft sponge.</ChecklistItem>
                    <ChecklistItem>Rinse thoroughly and dry with a clean lint-free towel or fresh paper towel.</ChecklistItem>
                    <ChecklistItem>Hold only the edges while reinstalling the dry plate.</ChecklistItem>
                  </ol>
                </div>
              </div>

              <Callout title="Do not print on a misplaced plate">
                The plate must lie completely flat on the magnetic heatbed. Check for debris
                underneath it and make sure neither rear corner overlaps an alignment point.
              </Callout>
            </section>

            <section id="troubleshooting" className="scroll-mt-24 py-10">
              <SectionHeading
                title="Troubleshooting"
                description="If Splintbot blocks printing or shows a printer error, do not repeatedly retry the job. Open the matching recovery procedure and complete each safety check."
              />

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {printerHelpArticles.map((article) => (
                  <Link
                    key={article.slug}
                    href={`/support/printer-errors/${article.slug}`}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:bg-[var(--surface-secondary)]"
                  >
                    <h3 className="font-semibold text-primary">{article.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-secondary">{article.summary}</p>
                  </Link>
                ))}
              </div>

              <Link href="/printer-help" className="btn-primary mt-6 inline-flex px-4 py-2 text-sm">
                Open all Printer Help
              </Link>
            </section>
          </article>
        </div>
      </main>
    </div>
  );
}

function SectionHeading({
  number,
  title,
  description,
}: {
  number?: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        {number && (
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--accent-blue)] font-semibold text-white">
            {number}
          </span>
        )}
        <h2 className="text-2xl font-semibold text-primary">{title}</h2>
      </div>
      <p className="mt-3 max-w-3xl leading-7 text-secondary">{description}</p>
    </div>
  );
}

function StepCard({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <li className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-blue)]">
        Step {number}
      </p>
      <h3 className="mt-2 text-lg font-semibold text-primary">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-secondary">{text}</p>
    </li>
  );
}

function QueueStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-[var(--accent-blue)] text-sm font-semibold text-[var(--accent-blue)]">
        {number}
      </span>
      <div>
        <h3 className="font-semibold text-primary">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-secondary">{text}</p>
      </div>
    </li>
  );
}

function ChecklistItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="mt-2 h-2 w-2 flex-none rounded-full bg-[var(--accent-green)]" />
      <span>{children}</span>
    </li>
  );
}

function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-xl border border-[var(--accent-blue)]/40 bg-[var(--surface-secondary)] p-5">
      <p className="font-semibold text-primary">{title}</p>
      <p className="mt-2 text-sm leading-6 text-secondary">{children}</p>
    </div>
  );
}
