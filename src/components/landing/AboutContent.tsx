'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/navigation/Header';

// Lifestyle images for the scrolling carousel (hero image excluded)
// Ordered to separate similar content (two guitar shots, splint colors)
const lifestyleImages = [
  { src: '/images/about/guitar-fretboard-green-splint.jpg', alt: 'Playing guitar while wearing a finger splint' },
  { src: '/images/about/kitchenaid-orange-splint-colorful-nails.jpg', alt: 'Using a kitchen mixer while wearing a finger splint' },
  { src: '/images/about/frisbee-toss-green-splint.jpg', alt: 'Tossing a frisbee outdoors while wearing a finger splint' },
  { src: '/images/about/notepad-checklist-dark-splint.jpg', alt: 'Writing a to-do list while wearing a finger splint' },
  { src: '/images/about/piano-keys-green-splint.jpg', alt: 'Playing piano while wearing a finger splint' },
  { src: '/images/about/barbell-grip-green-splint.jpg', alt: 'Gripping a barbell while wearing a finger splint' },
  { src: '/images/about/guitar-body-green-splint.jpg', alt: 'Hand on guitar body while wearing a finger splint' },
];

// Product detail images
const productImages = [
  { src: '/images/about/orange-splint-outdoor-stone.jpg', alt: 'Orange finger splint on stone surface' },
  { src: '/images/about/green-splint-white-surface.jpg', alt: 'Green finger splint on white surface' },
  { src: '/images/about/white-splint-dark-fabric-close.jpg', alt: 'White finger splint close-up' },
  { src: '/images/about/green-splint-light-fabric-close.jpg', alt: 'Green finger splint close-up on light fabric' },
];

// Hook: fade-in elements when they scroll into view
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('about-visible');
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function FadeIn({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useFadeIn();
  return (
    <div ref={ref} className={`about-fade-in ${className}`}>
      {children}
    </div>
  );
}

// Email contact modal - assembles address at runtime to deter scraping
function ProtectedEmail({ user, domain, label }: { user: string; domain: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const email = user + '@' + domain;
  const mailto = 'mai' + 'lto:' + email;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [email]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-[var(--accent-blue)] hover:text-[var(--accent-blue-hover)] underline underline-offset-2 transition-colors cursor-pointer"
      >
        {label}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => { setOpen(false); setCopied(false); }}
        >
          <div
            className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{label}</h3>
            <p className="text-[var(--text-secondary)] text-sm mb-6">Send an email or copy the address below:</p>
            <div className="flex items-center gap-2 bg-[var(--background)] rounded-lg px-4 py-3 mb-6 border border-[var(--border)]">
              <span className="text-[var(--text-primary)] font-mono text-sm flex-1 select-all">{email}</span>
              <button
                onClick={handleCopy}
                className="text-xs px-3 py-1.5 rounded-md bg-[var(--border)] hover:bg-[var(--text-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="flex gap-3">
              <a
                href={mailto}
                className="flex-1 text-center px-4 py-2.5 rounded-lg bg-[var(--accent-blue)] hover:brightness-110 text-white font-medium transition-all"
              >
                Open Mail Client
              </a>
              <button
                onClick={() => { setOpen(false); setCopied(false); }}
                className="px-4 py-2.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function AboutContent() {
  const { data: session, status } = useSession();
  const [carouselPaused, setCarouselPaused] = useState(false);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-blue)] mx-auto" />
      </div>
    );
  }

  const isLoggedIn = !!session?.user;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header variant="browser" />

      {/* -- Hero Section with Ken Burns background -- */}
      <section className="relative overflow-hidden" style={{ height: '80vh', minHeight: '500px' }}>
        <div className="absolute inset-0 about-ken-burns">
          <Image
            src="/images/about/basketball-reach-dark-splint.jpg"
            alt="Hand reaching for a basketball while wearing a Splint Factory orthosis"
            fill
            priority
            className="object-cover object-top"
            sizes="100vw"
          />
        </div>
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />

        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4">
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-white mb-4 tracking-tight">
            Splint Factory
          </h1>
          <p className="text-xl sm:text-2xl md:text-3xl text-blue-200 font-medium mb-6 max-w-3xl">
            Custom finger orthoses, printed in your clinic in under 20 minutes.
          </p>
          <p className="text-base sm:text-lg text-gray-300 max-w-2xl leading-relaxed mb-8">
            Durable, comfortable, and built for patients who need support that
            lasts — not just for days or weeks, but for years.
          </p>
          {!isLoggedIn && (
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/login"
                className="px-8 py-3 rounded-lg bg-[var(--accent-blue)] hover:brightness-110 text-white font-semibold text-lg transition-all shadow-lg"
              >
                Sign In
              </Link>
              <a
                href="#lifestyle"
                className="px-8 py-3 rounded-lg border-2 border-white/60 hover:border-white text-white font-semibold text-lg transition-all"
              >
                Learn More
              </a>
            </div>
          )}
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* -- Lifestyle Image Carousel -- */}
        <section id="lifestyle" className="py-16 -mx-4 sm:-mx-6 lg:-mx-8 overflow-hidden">
          <FadeIn>
            <p className="text-center text-[var(--text-tertiary)] text-sm uppercase tracking-widest mb-8">
              Built for real life
            </p>
          </FadeIn>
          <div
            className="about-carousel-track"
            onMouseEnter={() => setCarouselPaused(true)}
            onMouseLeave={() => setCarouselPaused(false)}
            style={{ animationPlayState: carouselPaused ? 'paused' : 'running' }}
          >
            {/* Duplicate images for seamless loop */}
            {[...lifestyleImages, ...lifestyleImages].map((img, i) => (
              <div key={i} className="about-carousel-item">
                <Image
                  src={img.src}
                  alt={img.alt}
                  width={480}
                  height={320}
                  className="rounded-lg object-cover w-full h-full"
                  sizes="(max-width: 640px) 280px, 480px"
                />
              </div>
            ))}
          </div>
        </section>

        <hr className="border-[var(--border)]" />

        {/* -- Why Splint Factory -- */}
        <section className="py-16">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-12 text-center">
              Why Splint Factory?
            </h2>
          </FadeIn>
          <div className="grid sm:grid-cols-2 gap-8">
            <FadeIn>
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
            </FadeIn>
            <FadeIn>
              <div className="relative rounded-lg overflow-hidden h-full min-h-[200px]">
                <Image
                  src="/images/about/boot-crush-test-orange-splint.jpg"
                  alt="Work boot stepping on a Splint Factory orthosis - durability test"
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 50vw"
                />
              </div>
            </FadeIn>
            <FadeIn>
              <FeatureCard
                title="Durable"
                description="These aren't just temporary solutions. Our orthoses are designed for long-term wear for patients managing chronic conditions who need something that holds up to daily life."
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                }
              />
            </FadeIn>
            <FadeIn>
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
            </FadeIn>
            <FadeIn>
              <FeatureCard
                title="Custom"
                description="Every orthosis is generated based on your patient's unique measurements. And not just for fit, but for protocol-specific angles and adjustments."
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.212-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
                  />
                }
              />
            </FadeIn>
          </div>
        </section>

        <hr className="border-[var(--border)]" />

        {/* -- Designed by a Hand Therapist -- */}
        <section className="py-16">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-8 text-center">
              Designed by a Hand Therapist
            </h2>
          </FadeIn>
          <FadeIn>
            <blockquote className="border-l-4 border-[var(--accent-blue)] pl-6 py-2 mb-6 max-w-3xl mx-auto">
              <p className="text-lg italic text-[var(--text-secondary)] leading-relaxed">
                &ldquo;We&rsquo;re not trying to reinvent the wheel, we just want to fill in the
                gaps.&rdquo;
              </p>
              <footer className="mt-3 text-[var(--text-tertiary)]">
                - <strong className="text-[var(--text-primary)]">Liz Allstadt, OTR/L, CHT</strong>{' '}
                &middot; Co-Founder &amp; Chief Medical Officer
              </footer>
            </blockquote>
          </FadeIn>
          <FadeIn>
            <p className="text-[var(--text-secondary)] leading-relaxed max-w-3xl mx-auto">
              Liz has seen the gaps in upper extremity care firsthand. Working in rural
              healthcare, she&rsquo;s aware of the pros and cons of thermoplastic and mail-order
              braces. She hopes to marry the convenience and customization of thermoplastic
              with the durability of mail-order or prefabricated orthoses.
            </p>
          </FadeIn>
        </section>

        <hr className="border-[var(--border)]" />

        {/* -- Our Designs with product images -- */}
        <section className="py-16">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-12 text-center">
              Our Designs
            </h2>
          </FadeIn>

          {/* Product image grid */}
          <FadeIn>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              {productImages.map((img, i) => (
                <div key={i} className="relative rounded-lg overflow-hidden aspect-square about-product-hover">
                  <Image
                    src={img.src}
                    alt={img.alt}
                    fill
                    className="object-cover transition-transform duration-700"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn>
            <p className="text-[var(--text-secondary)] mb-8 text-center max-w-2xl mx-auto">
              Our current lineup includes designs for:
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <FadeIn>
              <DesignCard
                title="Infinity Flex"
                detail="Our first and most refined design. Used for instability at the PIP joints, and can be used for a dorsal blocking orthosis series."
              />
            </FadeIn>
            <FadeIn>
              <DesignCard
                title="Infinity Extend"
                detail="For trigger fingers. Prevents tight composite fist while allowing functional movement for comfortable wear."
              />
            </FadeIn>
            <FadeIn>
              <DesignCard
                title="Infinity Extend Contracture"
                detail="A set of serial orthoses for PIP contracture."
              />
            </FadeIn>
          </div>

          <FadeIn>
            <p className="text-[var(--text-tertiary)] mt-8 text-center text-sm">
              Each design prints in under 20 minutes and requires only a few simple measurements
              from the clinician.
            </p>
          </FadeIn>
        </section>

        <hr className="border-[var(--border)]" />

        {/* -- Our Story -- */}
        <section className="py-16">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-8 text-center">
              Our Story
            </h2>
          </FadeIn>
          <div className="max-w-3xl mx-auto space-y-5 text-[var(--text-secondary)] leading-relaxed">
            <FadeIn>
              <p>
                Liz, a career clinician, noticed that finger orthoses were often ill-fitting, lost,
                or too fragile to last. Her patients in rural clinics couldn&rsquo;t easily come back
                for adjustments, and mail-order solutions meant weeks of waiting with no guarantee
                for a good fit.
              </p>
            </FadeIn>
            <FadeIn>
              <p>
                Meanwhile, Jon had a conversation with a family member - a plastic surgeon-in-training
                who was learning to fabricate a mallet finger splint. With
                years of experience in CAD, parametric design, and manufacturing engineering, he
                started brainstorming how to automate and simplify the process. He built a few prototypes 
                for and shared them with a friend.
              </p>
            </FadeIn>
            <FadeIn>
              <p>
                That mutual friend introduced them, and Splint Factory was born! Together, they&rsquo;ve
                developed a growing lineup of orthosis designs that print quickly, fit well, and
                last. The best part is they&rsquo;re not done! They have many more thoughts on how to
                innovate care to reduce burden and improve patient satisfaction.
              </p>
            </FadeIn>
            <FadeIn>
              <p className="font-semibold text-[var(--text-primary)] text-lg">
                Splint Factory is a MedTech company for specialists in upper extremity care.
                We&rsquo;re building practical tools for real clinical workflows. It&rsquo;s not tech for
                tech&rsquo;s sake, it&rsquo;s a way to make the day easier.
              </p>
            </FadeIn>
          </div>
        </section>

        <hr className="border-[var(--border)]" />

        {/* -- Contact / CTA -- */}
        <section id="contact" className="py-16 text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-4">
              Interested?
            </h2>
            <p className="text-[var(--text-secondary)] mb-8 max-w-xl mx-auto">
              We&rsquo;re currently working with early adopter clinics. If you&rsquo;d like to learn more
              or try Splint Factory in your practice, we&rsquo;d love to hear from you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
              <ProtectedEmail user="liz" domain="splintfactory.com" label="Email Liz" />
              <span className="text-[var(--text-muted)] hidden sm:inline">&middot;</span>
              <ProtectedEmail user="jon" domain="splintfactory.com" label="Email Jon" />
            </div>
          </FadeIn>
          {!isLoggedIn && (
            <FadeIn>
              <div className="mt-8 pt-8 border-t border-[var(--border)]">
                <p className="text-[var(--text-tertiary)] mb-4">Already have an account?</p>
                <Link
                  href="/login"
                  className="inline-flex items-center px-8 py-3 text-lg font-semibold rounded-lg bg-[var(--accent-blue)] hover:brightness-110 text-white transition-all shadow-lg"
                >
                  Sign In
                </Link>
              </div>
            </FadeIn>
          )}
        </section>
      </main>

      {/* -- Footer -- */}
      <footer className="border-t border-[var(--border)] py-8 text-center text-[var(--text-muted)] text-sm">
        <p>&copy; {new Date().getFullYear()} Splint Factory. All rights reserved.</p>
      </footer>

      {/* Inline styles for animations */}
      <style jsx global>{`
        /* Fade-in on scroll */
        .about-fade-in {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.7s ease-out, transform 0.7s ease-out;
        }
        .about-fade-in.about-visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* Ken Burns slow zoom on hero image */
        .about-ken-burns {
          animation: aboutKenBurns 20s ease-in-out infinite alternate;
        }
        @keyframes aboutKenBurns {
          0% { transform: scale(1); }
          100% { transform: scale(1.08); }
        }

        /* Infinite scrolling carousel */
        .about-carousel-track {
          display: flex;
          gap: 1rem;
          animation: aboutCarouselScroll 160s linear infinite;
          width: max-content;
        }
        .about-carousel-item {
          flex-shrink: 0;
          width: 280px;
          height: 187px;
          border-radius: 0.5rem;
          overflow: hidden;
        }
        @media (min-width: 640px) {
          .about-carousel-item {
            width: 480px;
            height: 320px;
          }
        }
        @keyframes aboutCarouselScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        /* Product image hover zoom */
        .about-product-hover:hover img {
          transform: scale(1.05);
        }
      `}</style>
    </div>
  );
}

/* -- Sub-components -- */

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
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 h-full">
      <div className="flex items-center gap-3 mb-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6 text-[var(--accent-blue)] flex-shrink-0"
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
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4 h-full">
      <h4 className="font-semibold text-[var(--text-primary)] mb-1">{title}</h4>
      <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">{detail}</p>
    </div>
  );
}
