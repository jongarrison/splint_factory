'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { Turnstile } from '@marsidev/react-turnstile'
import Header from '@/components/navigation/Header'
import { REGISTRATION_ACKNOWLEDGMENT_TEXT } from '@/lib/registration-acknowledgment'

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

export default function ConferencePage() {
  const [registrationEnabled, setRegistrationEnabled] = useState(false)
  const [statusLoading, setStatusLoading] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [responsibilityAcknowledged, setResponsibilityAcknowledged] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [accountCreated, setAccountCreated] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/conference/status', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load conference registration status')
        const data = await response.json() as { registrationEnabled: boolean }
        setRegistrationEnabled(data.registrationEnabled)
      })
      .catch(() => setRegistrationEnabled(false))
      .finally(() => setStatusLoading(false))
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/conference/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          responsibilityAcknowledged,
          turnstileToken: turnstileToken || undefined,
        }),
      })
      const data = await response.json() as {
        error?: string
        code?: string
        outcome?: string
        loginToken?: string
      }

      if (response.status === 409 && data.code === 'ACCOUNT_EXISTS') {
        window.location.href = '/login?message=An account already exists for that email. Please sign in or reset your password.'
        return
      }
      if (!response.ok) throw new Error(data.error || 'Unable to submit your information')

      if (data.outcome === 'account-created' && data.loginToken) {
        setAccountCreated(true)
        const result = await signIn('conference-registration', {
          token: data.loginToken,
          redirect: false,
        })
        if (result?.error) {
          setError('Your account was created, but automatic sign-in failed. Use Forgot Password on the login page to continue.')
          return
        }
        window.location.href = '/design-menu'
        return
      }

      setSubmitted(true)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit your information')
      setTurnstileToken(null)
      setCaptchaKey((current) => current + 1)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen page-shell">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-12 sm:px-6">
        <div className="mb-8 text-center">
          <h1 className="page-title">Conference Access</h1>
          <p className="mt-3 text-secondary">
            Explore the Splint Factory catalog, enter measurements, and see a custom 3D splint model.
          </p>
        </div>

        {submitted ? (
          <section className="card p-8 text-center" data-testid="conference-thanks">
            <h2 className="text-2xl font-semibold text-primary">Thank you for your interest</h2>
            <p className="mt-3 text-secondary">
              We received your information and will get back to you with more information about access.
            </p>
            <Link href="/" className="btn-primary inline-flex mt-6 px-5 py-2.5">Visit Splint Factory</Link>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 sm:p-8 space-y-5" data-testid="conference-form">
            <div>
              <label htmlFor="conference-name" className="block text-sm font-medium text-secondary mb-1">Full Name</label>
              <input id="conference-name" type="text" required value={name} onChange={(event) => setName(event.target.value)} className="input-field" autoComplete="name" data-testid="conference-name" />
            </div>
            <div>
              <label htmlFor="conference-email" className="block text-sm font-medium text-secondary mb-1">Email Address</label>
              <input id="conference-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="input-field" autoComplete="email" data-testid="conference-email" />
            </div>
            <div>
              <label htmlFor="conference-phone" className="block text-sm font-medium text-secondary mb-1">
                Phone <span className="text-muted font-normal">(optional)</span>
              </label>
              <input id="conference-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="input-field" autoComplete="tel" data-testid="conference-phone" />
            </div>

            {!statusLoading && registrationEnabled && (
              <label className="flex items-start gap-3 text-sm text-secondary">
                <input
                  type="checkbox"
                  checked={responsibilityAcknowledged}
                  onChange={(event) => setResponsibilityAcknowledged(event.target.checked)}
                  required
                  className="mt-1 h-4 w-4 rounded"
                  data-testid="conference-acknowledgment"
                />
                <span>{REGISTRATION_ACKNOWLEDGMENT_TEXT}</span>
              </label>
            )}

            {SITE_KEY && (
              <Turnstile
                key={captchaKey}
                siteKey={SITE_KEY}
                onSuccess={setTurnstileToken}
                onExpire={() => setTurnstileToken(null)}
                onError={() => setTurnstileToken(null)}
                options={{ theme: 'dark' }}
              />
            )}

            {error && <div className="alert-error" data-testid="conference-error">{error}</div>}
            {accountCreated && error && (
              <Link href="/login" className="text-link text-sm font-medium">Go to login</Link>
            )}

            <button
              type="submit"
              disabled={statusLoading || submitting || (Boolean(SITE_KEY) && !turnstileToken)}
              className="btn-primary w-full py-3 disabled:opacity-50"
              data-testid="conference-submit"
            >
              {submitting ? 'Submitting...' : registrationEnabled ? 'Create Account and Explore' : 'Request Access'}
            </button>
            <p className="text-xs text-muted text-center">
              {registrationEnabled
                ? 'You can begin immediately. Please verify your email within 24 hours to retain access.'
                : 'Conference registration is not currently active.'}
            </p>
          </form>
        )}
      </main>
    </div>
  )
}