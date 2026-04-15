'use client';

import { useState, useEffect, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '@/components/navigation/Header';

export default function ClientAuthPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const resolvedParams = use(params);
  const challengeId = resolvedParams.id;

  const [challenge, setChallenge] = useState<{
    challengeId: string;
    deviceName: string;
    deviceId: string;
    expiresAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) {
      // Redirect to login, then come back here
      router.push(`/login?callbackUrl=/client-auth/${challengeId}`);
      return;
    }
    fetchAndAutoApprove();
  }, [status, session, challengeId]);

  const fetchAndAutoApprove = async () => {
    try {
      const res = await fetch(`/api/client-auth/${challengeId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load challenge');
      }
      const data = await res.json();
      setChallenge(data);
      setLoading(false);
      // Auto-approve: scanning the QR code is the intentional act
      await doApprove(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const doApprove = async (challengeData: typeof challenge) => {
    setApproving(true);
    setError(null);
    try {
      const res = await fetch(`/api/client-auth/${challengeId}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to approve');
      }
      setApproved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setApproving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="page-shell" data-testid="client-auth-loading">
        <Header />
        <div className="max-w-md mx-auto px-4 py-16 text-center text-muted">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell" data-testid="client-auth-page">
      <Header />
      <div className="max-w-md mx-auto px-4 py-16">
        {error && !approved && (
          <div className="card p-8 text-center" data-testid="error-card">
            <div className="text-[var(--status-error-text)] text-5xl mb-4">!</div>
            <h1 className="text-xl font-bold text-primary mb-2">
              Unable to Authorize
            </h1>
            <p className="text-muted">{error}</p>
          </div>
        )}

        {approved && (
          <div className="card p-8 text-center" data-testid="approved-card">
            <div className="text-[var(--status-ok-text)] text-5xl mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-primary mb-2">
              Device Authorized
            </h1>
            <p className="text-muted">
              You are now the active operator on <strong>{challenge?.deviceName}</strong>.
              You can close this page.
            </p>
          </div>
        )}

        {!error && !approved && challenge && (
          <div className="card p-8 text-center" data-testid="approving-card">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-blue)] mx-auto mb-4"></div>
            <h1 className="text-xl font-bold text-primary mb-2">
              Authorizing...
            </h1>
            <p className="text-sm text-muted">
              Signing in as <strong>{session?.user?.name || session?.user?.email}</strong> on <strong>{challenge.deviceName}</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
