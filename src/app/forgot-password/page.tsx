'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Something went wrong');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-[var(--background)] to-[var(--surface-secondary)]" data-testid="forgot-password-page">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          {submitted ? (
            <div className="card p-8 text-center" data-testid="success-card">
              <svg className="mx-auto h-12 w-12 text-[var(--status-ok-text)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h2 className="text-2xl font-bold text-primary mb-2">Check your email</h2>
              <p className="text-muted mb-6">
                If an account exists for <span className="text-secondary">{email}</span>, we sent a password reset link. It expires in 1 hour.
              </p>
              <Link
                href="/login"
                className="text-link text-sm font-medium"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-extrabold text-primary">
                  Forgot your password?
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Enter your email and we will send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="sr-only">Email address</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="input-field w-full text-sm"
                    data-testid="email-input"
                    placeholder="Email address"
                  />
                </div>

                {error && (
                  <div className="text-sm text-center text-[var(--status-error-text)]" data-testid="error-message">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className="btn-primary w-full flex justify-center py-2 px-4 text-sm disabled:opacity-50"
                  data-testid="submit-btn"
                >
                  {sending ? 'Sending...' : 'Send Reset Link'}
                </button>

                <div className="text-center">
                  <Link
                    href="/login"
                    className="text-link text-sm"
                  >
                    Back to Sign In
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
