'use client';

import { useRef, useState } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import Header from '@/components/navigation/Header';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
// In dev (no site key), bypass captcha requirement so the form is testable
const CAPTCHA_REQUIRED = SITE_KEY !== '';

export default function MoreInformationContent() {
  const [form, setForm] = useState({
    name: '',
    city: '',
    stateProvince: '',
    country: '',
    email: '',
    phone: '',
    organization: '',
    medicalSpecialty: '',
    interestedWaitlist: false,
    interestedInfo: false,
    interestedUpdates: false,
    notes: '',
  });

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const turnstileRef = useRef<{ reset: () => void }>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setForm(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!turnstileToken) {
      setError('Please complete the captcha verification.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/more-information', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, turnstileToken }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? 'Something went wrong. Please try again.');
        turnstileRef.current?.reset();
        setTurnstileToken(null);
      } else {
        setSubmitted(true);
      }
    } catch {
      setError('Network error. Please try again.');
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  const fieldClass = 'w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:border-transparent';
  const labelClass = 'block text-sm font-medium text-[var(--text-secondary)] mb-1';
  const checkboxRowClass = 'flex items-start gap-3 py-2';

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-16 sm:px-6">
        {submitted ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--status-success-bg)] mb-6">
              <svg className="w-8 h-8 text-[var(--status-success-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-4">You&apos;re on the list!</h1>
            <p className="text-[var(--text-secondary)] text-lg max-w-md mx-auto">
              Thanks for your interest in Splint Factory. We&apos;ll be in touch as we get closer to launch.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-4">Stay in the Loop</h1>
              <p className="text-[var(--text-secondary)] text-lg max-w-lg mx-auto">
                Splint Factory is building the next generation of custom 3D-printed orthotic splints for hand therapy clinics.
                Sign up to get early access information and updates.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="card p-8 space-y-6">
              {/* Name */}
              <div>
                <label htmlFor="name" className={labelClass}>Name <span className="text-[var(--status-error-text)]">*</span></label>
                <input id="name" name="name" type="text" required value={form.name} onChange={handleChange} className={fieldClass} />
              </div>

              {/* Location row */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="city" className={labelClass}>City <span className="text-[var(--status-error-text)]">*</span></label>
                  <input id="city" name="city" type="text" required value={form.city} onChange={handleChange} className={fieldClass} />
                </div>
                <div>
                  <label htmlFor="stateProvince" className={labelClass}>State / Province <span className="text-[var(--status-error-text)]">*</span></label>
                  <input id="stateProvince" name="stateProvince" type="text" required value={form.stateProvince} onChange={handleChange} className={fieldClass} />
                </div>
                <div>
                  <label htmlFor="country" className={labelClass}>Country <span className="text-[var(--status-error-text)]">*</span></label>
                  <input id="country" name="country" type="text" required value={form.country} onChange={handleChange} className={fieldClass} />
                </div>
              </div>

              {/* Contact row */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className={labelClass}>Email Address <span className="text-[var(--status-error-text)]">*</span></label>
                  <input id="email" name="email" type="email" required value={form.email} onChange={handleChange} className={fieldClass} />
                </div>
                <div>
                  <label htmlFor="phone" className={labelClass}>Phone <span className="text-[var(--text-muted)] font-normal">(optional)</span></label>
                  <input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} className={fieldClass} />
                </div>
              </div>

              {/* Organization */}
              <div>
                <label htmlFor="organization" className={labelClass}>Organization / Clinic <span className="text-[var(--status-error-text)]">*</span></label>
                <input id="organization" name="organization" type="text" required value={form.organization} onChange={handleChange} className={fieldClass} />
              </div>

              {/* Medical Specialty */}
              <div>
                <label htmlFor="medicalSpecialty" className={labelClass}>Medical Specialty <span className="text-[var(--status-error-text)]">*</span></label>
                <input
                  id="medicalSpecialty"
                  name="medicalSpecialty"
                  type="text"
                  required
                  placeholder="e.g. Hand Therapy, Occupational Therapy, Orthotics"
                  value={form.medicalSpecialty}
                  onChange={handleChange}
                  className={fieldClass}
                />
              </div>

              {/* Interested In */}
              <div>
                <p className={labelClass}>I&apos;m interested in:</p>
                <div className="space-y-1 mt-1">
                  <label className={checkboxRowClass}>
                    <input
                      type="checkbox"
                      name="interestedWaitlist"
                      checked={form.interestedWaitlist}
                      onChange={handleChange}
                      className="mt-0.5 h-4 w-4 rounded border-[var(--border)] accent-[var(--accent-blue)]"
                    />
                    <span className="text-sm text-[var(--text-primary)]">Getting on the waitlist for the Splint Factory printing platform</span>
                  </label>
                  <label className={checkboxRowClass}>
                    <input
                      type="checkbox"
                      name="interestedInfo"
                      checked={form.interestedInfo}
                      onChange={handleChange}
                      className="mt-0.5 h-4 w-4 rounded border-[var(--border)] accent-[var(--accent-blue)]"
                    />
                    <span className="text-sm text-[var(--text-primary)]">Information about our system</span>
                  </label>
                  <label className={checkboxRowClass}>
                    <input
                      type="checkbox"
                      name="interestedUpdates"
                      checked={form.interestedUpdates}
                      onChange={handleChange}
                      className="mt-0.5 h-4 w-4 rounded border-[var(--border)] accent-[var(--accent-blue)]"
                    />
                    <span className="text-sm text-[var(--text-primary)]">Receiving occasional email updates from Splint Factory</span>
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className={labelClass}>Anything else you&apos;d like to know? <span className="text-[var(--text-muted)] font-normal">(optional)</span></label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  value={form.notes}
                  onChange={handleChange}
                  className={`${fieldClass} resize-none`}
                  placeholder="Questions, use cases, anything on your mind..."
                />
              </div>

              {/* Captcha */}
              <div>
                {SITE_KEY ? (
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={SITE_KEY}
                    onSuccess={token => setTurnstileToken(token)}
                    onExpire={() => setTurnstileToken(null)}
                    onError={() => setTurnstileToken(null)}
                    options={{ theme: 'dark' }}
                  />
                ) : (
                  <p className="text-xs text-[var(--text-muted)]">Captcha: NEXT_PUBLIC_TURNSTILE_SITE_KEY not configured</p>
                )}
              </div>

              {error && (
                <p className="text-sm text-[var(--status-error-text)] bg-[var(--status-error-bg)] rounded-lg px-4 py-3">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting || (CAPTCHA_REQUIRED && !turnstileToken)}
                className="w-full py-3 px-6 rounded-lg font-semibold text-white bg-[var(--accent-blue)] hover:bg-[var(--accent-blue-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
