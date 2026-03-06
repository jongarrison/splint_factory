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
    fetchChallenge();
  }, [status, session, challengeId]);

  const fetchChallenge = async () => {
    try {
      const res = await fetch(`/api/client-auth/${challengeId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load challenge');
      }
      const data = await res.json();
      setChallenge(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="max-w-md mx-auto px-4 py-16 text-center text-gray-500">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="max-w-md mx-auto px-4 py-16">
        {error && !approved && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <div className="text-red-500 text-5xl mb-4">!</div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Unable to Authorize
            </h1>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
          </div>
        )}

        {approved && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <div className="text-green-500 text-5xl mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Device Authorized
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              You are now the active operator on <strong>{challenge?.deviceName}</strong>.
              You can close this page.
            </p>
          </div>
        )}

        {!error && !approved && challenge && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 text-center">
              Authorize Device
            </h1>

            <div className="mb-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Device</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">{challenge.deviceName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Operator</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">{session?.user?.name || session?.user?.email}</span>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
              Tap below to become the active operator on this device.
              All actions will be recorded under your account.
            </p>

            <button
              onClick={handleApprove}
              disabled={approving}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-4 px-4 rounded-lg transition-colors text-lg"
            >
              {approving ? 'Authorizing...' : 'Authorize'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
