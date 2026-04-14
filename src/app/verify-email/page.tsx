'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { signOut } from 'next-auth/react';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-[var(--background)] to-[var(--surface-secondary)]">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md w-full card p-8 text-center">
            <div className="mx-auto h-12 w-12 mb-4 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--accent-blue)]" />
            <h2 className="text-2xl font-bold text-primary mb-2">Loading...</h2>
          </div>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'idle' | 'verifying' | 'verified' | 'error'>('idle');
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const verifyToken = useCallback(async (t: string) => {
    setStatus('verifying');
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Verification failed');
        setStatus('error');
        return;
      }
      setStatus('verified');
    } catch {
      setError('Something went wrong');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (token) {
      verifyToken(token);
    }
  }, [token, verifyToken]);

  const handleResend = async () => {
    setResending(true);
    setResent(false);
    setError('');
    try {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to resend');
      } else {
        setResent(true);
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };

  // Token present: show verification progress
  if (token) {
    return (
      <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-[var(--background)] to-[var(--surface-secondary)]" data-testid="verify-email-token">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md w-full card p-8 text-center">
            {status === 'verifying' && (
              <>
                <div className="mx-auto h-12 w-12 mb-4 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--accent-blue)]" />
                <h2 className="text-2xl font-bold text-primary mb-2">Verifying your email...</h2>
                <p className="text-muted">Please wait.</p>
              </>
            )}
            {status === 'verified' && (
              <>
                <svg className="mx-auto h-12 w-12 text-[var(--status-ok-text)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <h2 className="text-2xl font-bold text-primary mb-2">Email verified!</h2>
                <p className="text-muted mb-6">
                  Your email has been verified. Please sign in again to continue.
                </p>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="btn-primary px-6 py-2 text-sm"
                  data-testid="sign-in-btn"
                >
                  Sign In
                </button>
              </>
            )}
            {status === 'error' && (
              <>
                <svg className="mx-auto h-12 w-12 text-[var(--status-error-text)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-2xl font-bold text-primary mb-2">Verification failed</h2>
                <p className="text-[var(--status-error-text)] mb-6">{error}</p>
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="text-link text-sm font-medium disabled:opacity-50"
                  data-testid="resend-btn"
                >
                  {resending ? 'Sending...' : 'Resend verification email'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // No token: show "check your email" with resend option
  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-[var(--background)] to-[var(--surface-secondary)]" data-testid="verify-email-page">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full card p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-[var(--accent-blue)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <h2 className="text-2xl font-bold text-primary mb-2">Verify your email</h2>
          <p className="text-muted mb-6">
            We sent a verification link to your email address. Please check your inbox and click the link to continue.
          </p>

          {error && (
            <p className="text-sm mb-4 text-[var(--status-error-text)]">{error}</p>
          )}

          {resent && (
            <p className="text-sm mb-4 text-[var(--status-ok-text)]">Verification email sent!</p>
          )}

          <button
            onClick={handleResend}
            disabled={resending}
            className="btn-primary w-full flex justify-center py-2 px-4 text-sm disabled:opacity-50 mb-4"
            data-testid="resend-btn"
          >
            {resending ? 'Sending...' : 'Resend verification email'}
          </button>

          <button
            onClick={handleSignOut}
            className="text-sm text-muted hover:text-primary"
            data-testid="sign-out-btn"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
