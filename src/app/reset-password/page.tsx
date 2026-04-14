'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { validatePassword, PASSWORD_REQUIREMENTS_TEXT } from '@/lib/password';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-[var(--background)] to-[var(--surface-secondary)]" data-testid="reset-no-token">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-primary mb-4">Invalid Reset Link</h2>
            <p className="text-muted mb-6">This password reset link is missing or malformed.</p>
            <Link href="/forgot-password" className="text-link text-sm font-medium">
              Request a new reset link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      setError(passwordCheck.errors.join('. '));
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-[var(--background)] to-[var(--surface-secondary)]" data-testid="reset-success">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <svg className="mx-auto h-12 w-12 text-[var(--status-ok-text)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <h2 className="text-2xl font-bold text-primary mb-2">Password Reset</h2>
            <p className="text-muted mb-6">Your password has been updated successfully.</p>
            <Link
              href="/login"
              className="btn-primary inline-flex items-center px-4 py-2 text-sm"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-[var(--background)] to-[var(--surface-secondary)]" data-testid="reset-password-page">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold text-primary">
              Set new password
            </h2>
            <p className="mt-2 text-sm text-muted">
              {PASSWORD_REQUIREMENTS_TEXT}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-secondary mb-1">
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-field w-full text-sm"
                data-testid="password-input"
                placeholder="New password"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-secondary mb-1">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={`input-field w-full text-sm ${
                  confirmPassword && password !== confirmPassword
                    ? 'border-[var(--status-error-text)]'
                    : ''
                }`}
                data-testid="confirm-password-input"
                placeholder="Confirm new password"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs mt-1 text-[var(--status-error-text)]">Passwords do not match</p>
              )}
            </div>

            {error && (
              <div className="text-sm text-center text-[var(--status-error-text)]" data-testid="error-message">{error}</div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full flex justify-center py-2 px-4 text-sm disabled:opacity-50"
              data-testid="submit-btn"
            >
              {submitting ? 'Resetting...' : 'Reset Password'}
            </button>

            <div className="text-center">
              <Link href="/login" className="text-link text-sm">
                Back to Sign In
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen bg-gradient-to-br from-[var(--background)] to-[var(--surface-secondary)] flex items-center justify-center">
          <div className="text-muted">Loading...</div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
