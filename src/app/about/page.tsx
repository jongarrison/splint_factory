'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Header from '@/components/navigation/Header';

export default function AboutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) {
      router.push('/login');
    }
  }, [session, status, router]);

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-blue)] mx-auto" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header variant="browser" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <section className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--text-primary)] mb-4">
            Splint Factory
          </h1>
          <p className="text-xl md:text-2xl text-[var(--accent-blue)] font-medium mb-6">
            Custom finger orthoses, printed in your clinic in under 20 minutes.
          </p>
          <p className="text-lg text-[var(--text-secondary)] max-w-3xl mx-auto leading-relaxed">
            Splint Factory brings 3D-printed, custom-fit finger orthoses directly to your
            practice. Our designs are durable, comfortable, and built for patients who need
            support that lasts — not just days or weeks, but years.
          </p>
          <p className="mt-4 text-[var(--text-tertiary)] text-base max-w-2xl mx-auto">
            Just a few simple measurements. A short print. A better fit for your patient.
          </p>
        </section>

        <hr className="border-[var(--border)] mb-16" />

        {/* Why Splint Factory */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-8 text-center">
            Why Splint Factory?
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <FeatureCard
              title="Fast"
              description="Our designs print in under 20 minutes on a standard 3D printer in your own clinic. No waiting on mail-order. No second appointments weeks later because the fit wasn't right."
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                />
              }
            />
            <FeatureCard
              title="Durable"
              description="These aren't temporary solutions. Our orthoses are designed for long-term wear — for patients managing chronic conditions who need something that holds up to daily life."
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              }
            />
            <FeatureCard
              title="Simple"
              description="You don't need to be a tech expert. Choose a design, take a few measurements, and print. We built this for busy clinicians, not engineers."
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              }
            />
            <FeatureCard
              title="Custom"
              description="Every orthosis is generated based on the design to your patient's specific measurements."
              icon={
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.42 15.17l-5.384 3.07A1.5 1.5 0 014.5 16.97V7.03a1.5 1.5 0 011.536-1.27l5.384 3.07a1.5 1.5 0 010 2.34zM15.75 7.5v9"
                />
              }
            />
          </div>
        </section>

        <hr className="border-[var(--border)] mb-16" />

        {/* Designed by a Hand Therapist */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-8 text-center">
            Designed by a Hand Therapist
          </h2>
          <blockquote className="border-l-4 border-[var(--accent-blue)] pl-6 py-2 mb-6">
            <p className="text-lg italic text-[var(--text-secondary)] leading-relaxed">
              &ldquo;We&rsquo;re not trying to reinvent the wheel — we just want to fill in the
              gaps.&rdquo;
            </p>
            <footer className="mt-3 text-[var(--text-tertiary)]">
              — <strong className="text-[var(--text-primary)]">Liz Allstadt, OTR/L, CHT</strong>{' '}
              · Co-Founder &amp; Chief Medical Officer
            </footer>
          </blockquote>
          <p className="text-[var(--text-secondary)] leading-relaxed">
            Liz has seen the gaps in upper extremity care firsthand. Working in rural
            healthcare, she watched patients wait weeks for a mail-order orthosis — and if
            the fit wasn&rsquo;t right, the whole process started over. She knew there had to be a
            better way.
          </p>
        </section>

        <hr className="border-[var(--border)] mb-16" />

        {/* Our Designs */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-8 text-center">
            Our Designs
          </h2>
          <p className="text-[var(--text-secondary)] mb-6 text-center">
            Our current lineup includes designs for:
          </p>
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <DesignCard title="Mallet finger" detail="Our first and most refined design" />
            <DesignCard title="Lateral support" detail="For joint instability and arthritis" />
            <DesignCard
              title="Deviation correction"
              detail="Progressive correction for finger alignment"
            />
            <DesignCard title="Trigger finger" detail="Support during active use" />
          </div>
          <p className="text-[var(--text-tertiary)] mt-6 text-center text-sm">
            Each design prints in under 20 minutes and requires only a few simple measurements
            from the clinician.
          </p>
        </section>

        <hr className="border-[var(--border)] mb-16" />

        {/* Our Story */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-8 text-center">
            Our Story
          </h2>
          <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed">
            <p>
              Splint Factory was born when two people who had been dreaming of the same thing
              finally met.
            </p>
            <p>
              Liz saw the gaps in care every day — finger orthoses that were ill-fitting, too
              expensive, or too fragile to last. Her patients in rural clinics couldn&rsquo;t easily
              come back for adjustments, and mail-order solutions meant weeks of waiting with
              no guarantee of a good fit.
            </p>
            <p>
              Meanwhile, Jon had been asked by a family member — a plastic surgeon in training
              with no access to a hand therapist — to fabricate a mallet finger splint. With
              years of experience in CAD, parametric design, and manufacturing engineering, he
              jumped at the challenge.
            </p>
            <p>
              When a mutual friend introduced them, it clicked immediately. Liz brought the
              clinical expertise to refine Jon&rsquo;s original design into something that actually
              worked for patients and clinicians. Together, they&rsquo;ve developed a growing lineup
              of orthosis designs that print quickly, fit well, and last.
            </p>
            <p className="font-semibold text-[var(--text-primary)]">
              Splint Factory is a MedTech company for specialists in upper extremity care. We&rsquo;re
              building practical tools for real clinical workflows — not tech for tech&rsquo;s sake.
            </p>
          </div>
        </section>

        <hr className="border-[var(--border)] mb-16" />

        {/* Interested? */}
        <section className="text-center mb-8">
          <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-4">
            Interested?
          </h2>
          <p className="text-[var(--text-secondary)] mb-6 max-w-xl mx-auto">
            We&rsquo;re currently working with early adopter clinics. If you&rsquo;d like to learn more
            or try Splint Factory in your practice, we&rsquo;d love to hear from you.
          </p>
          <a
            href="mailto:contact@splintfactory.com"
            className="inline-flex items-center px-6 py-3 text-base font-medium rounded-lg bg-[var(--accent-blue)] hover:brightness-110 text-white transition-all shadow-sm"
          >
            Contact Us →
          </a>
        </section>
      </main>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────────────── */

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex items-center gap-3 mb-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6 text-[var(--accent-blue)]"
        >
          {icon}
        </svg>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
      </div>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
    </div>
  );
}

function DesignCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <h4 className="font-semibold text-[var(--text-primary)]">{title}</h4>
      <p className="text-sm text-[var(--text-tertiary)] mt-1">{detail}</p>
    </div>
  );
}
