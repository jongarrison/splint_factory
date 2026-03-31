'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface DeviceAuthOverlayProps {
  // Called when the overlay needs to create a new challenge
  onCreateChallenge: () => Promise<{ challengeId: string; expiresAt: string } | null>;
  // Called when the overlay detects an approved challenge from polling headers
  onExchangeSession: (challengeId: string) => Promise<boolean>;
  // Called to force an immediate refresh of the print queue (and check headers)
  onRefreshPoll?: () => void;
  // The base URL for building QR code URLs
  factoryUrl: string;
  // The device ID for status polling
  deviceId: string;
  // Whether a challenge-approved header was detected in the latest poll
  approvedChallengeId: string | null;
  approvedUserName: string | null;
  // Inactivity timeout in ms (default 60s)
  inactivityTimeout?: number;
  // Callback when lock state changes (so parent can disable buttons)
  onLockStateChange: (locked: boolean) => void;
}

export default function DeviceAuthOverlay({
  onCreateChallenge,
  onExchangeSession,
  onRefreshPoll,
  factoryUrl,
  deviceId,
  approvedChallengeId,
  approvedUserName,
  inactivityTimeout = 60_000,
  onLockStateChange,
}: DeviceAuthOverlayProps) {
  const [locked, setLocked] = useState(false);
  const [challenge, setChallenge] = useState<{ challengeId: string; expiresAt: string } | null>(null);
  const [exchanging, setExchanging] = useState(false);
  const [showManualLogin, setShowManualLogin] = useState(false);
  const [approvedInfo, setApprovedInfo] = useState<{ challengeId: string; userName: string } | null>(null);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const challengeRefreshTimer = useRef<NodeJS.Timeout | null>(null);

  // Stable ref for onRefreshPoll to avoid effect dependency on callback identity
  const onRefreshPollRef = useRef(onRefreshPoll);
  onRefreshPollRef.current = onRefreshPoll;

  // Stable ref for onExchangeSession to avoid re-triggering the exchange effect
  const onExchangeSessionRef = useRef(onExchangeSession);
  onExchangeSessionRef.current = onExchangeSession;

  // Reset inactivity timer on any user interaction
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    // If currently locked, user interaction shouldn't unlock (they need to scan QR)
    if (locked) return;

    inactivityTimer.current = setTimeout(() => {
      console.log('[DeviceAuth] Inactivity timeout reached, locking device');
      setLocked(true);
      onLockStateChange(true);
    }, inactivityTimeout);
  }, [locked, inactivityTimeout, onLockStateChange]);

  // Attach interaction listeners
  useEffect(() => {
    const events = ['mousedown', 'touchstart', 'keydown', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetInactivityTimer, { passive: true }));
    // Start the initial timer
    resetInactivityTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetInactivityTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [resetInactivityTimer]);

  // When locked, create a challenge for QR code
  useEffect(() => {
    if (!locked) {
      setChallenge(null);
      setApprovedInfo(null);
      if (challengeRefreshTimer.current) clearTimeout(challengeRefreshTimer.current);
      return;
    }

    const createNewChallenge = async () => {
      try {
        const result = await onCreateChallenge();
        if (result) {
          console.log('[DeviceAuth] Challenge created:', result.challengeId, 'expires:', result.expiresAt);
          setChallenge(result);
          // Auto-refresh challenge before it expires (at 4 minutes)
          const expiresIn = new Date(result.expiresAt).getTime() - Date.now();
          const refreshIn = Math.max(expiresIn - 60_000, 30_000);
          challengeRefreshTimer.current = setTimeout(createNewChallenge, refreshIn);
        } else {
          console.warn('[DeviceAuth] Challenge creation returned null, retrying in 10s');
          challengeRefreshTimer.current = setTimeout(createNewChallenge, 10_000);
        }
      } catch (err) {
        console.error('[DeviceAuth] Challenge creation error, retrying in 10s:', err);
        challengeRefreshTimer.current = setTimeout(createNewChallenge, 10_000);
      }
    };

    createNewChallenge();

    return () => {
      if (challengeRefreshTimer.current) clearTimeout(challengeRefreshTimer.current);
    };
  }, [locked, onCreateChallenge]);

  // Poll for challenge approval when locked with an active challenge
  useEffect(() => {
    if (!locked || !challenge) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/client-auth/${challenge.challengeId}?status=true`, {
          headers: { 'X-Device-ID': deviceId },
        });
        if (!res.ok) {
          console.warn('[DeviceAuth] Poll status check failed:', res.status);
          return;
        }
        const data = await res.json();
        if (data.authorizedAt && data.authorizedBy) {
          console.log('[DeviceAuth] Poll detected approval for challenge:', challenge.challengeId, 'by:', data.authorizedBy.name);
          setApprovedInfo({
            challengeId: challenge.challengeId,
            userName: data.authorizedBy.name || 'operator',
          });
        }
      } catch (err) {
        console.warn('[DeviceAuth] Poll fetch error:', err);
      }
    }, 3000);

    // Also trigger parent poll if provided (via ref to avoid dependency loop)
    onRefreshPollRef.current?.();

    return () => clearInterval(pollInterval);
  }, [locked, challenge]);

  // When polling detects an approved challenge (from self-poll or parent headers), exchange it
  useEffect(() => {
    // Prefer self-polled approval, fall back to parent-supplied
    const challengeId = approvedInfo?.challengeId || approvedChallengeId;
    const userName = approvedInfo?.userName || approvedUserName;
    if (!locked || !challengeId || exchanging) {
      console.log('[DeviceAuth] Exchange effect skipped:', { locked, challengeId: challengeId || 'none', exchanging });
      return;
    }

    console.log('[DeviceAuth] Starting exchange for challenge:', challengeId);
    const doExchange = async () => {
      setExchanging(true);
      try {
        const success = await onExchangeSessionRef.current(challengeId);
        console.log('[DeviceAuth] Exchange result:', success);
        if (success) {
          console.log('[DeviceAuth] Unlocking device');
          setLocked(false);
          onLockStateChange(false);
          resetInactivityTimer();
        }
      } catch (err) {
        console.error('[DeviceAuth] Exchange session failed:', err);
      } finally {
        setExchanging(false);
      }
    };

    doExchange();
  }, [approvedInfo, approvedChallengeId, approvedUserName, locked, exchanging, onLockStateChange, resetInactivityTimer]);

  if (!locked) {
    // Show a compact "Switch User" bar at the bottom when unlocked
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="bg-gray-900/90 backdrop-blur border-t border-gray-700 px-6 py-3">
          <div className="max-w-lg mx-auto flex items-center justify-center">
            <button
              onClick={() => {
                setLocked(true);
                onLockStateChange(true);
              }}
              className="flex items-center gap-2 text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Switch User
            </button>
          </div>
        </div>
      </div>
    );
  }

  const qrUrl = challenge ? `${factoryUrl}/client-auth/${challenge.challengeId}` : null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
      {/* Semi-transparent overlay that blocks interactions on the page beneath */}
      <div
        className="fixed inset-0 bg-blue-900/30 pointer-events-auto flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center bg-gray-900/80 backdrop-blur rounded-xl px-8 py-5 shadow-lg">
          <svg className="w-10 h-10 mx-auto mb-2 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div className="text-white text-base font-medium">Screen Locked</div>
          <div className="text-white/60 text-sm mt-1">Log in below to continue</div>
        </div>
      </div>

      {/* QR code bar at bottom */}
      <div className="relative pointer-events-auto bg-gray-900/95 backdrop-blur border-t border-gray-700 px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-6">
          {/* QR Code */}
          <div className="flex-shrink-0">
            {qrUrl ? (
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#ffffff' }}>
                <QRCodeSVG value={qrUrl} size={120} level="M" />
              </div>
            ) : (
              <div className="w-[152px] h-[152px] bg-gray-700 rounded-lg animate-pulse" />
            )}
          </div>

          {/* Instructions */}
          <div className="flex-1 min-w-0">
            {exchanging ? (
              <div className="text-white">
                <div className="font-semibold text-lg">Signing in...</div>
                <div className="text-gray-300 text-sm mt-1">
                  Welcome, {approvedInfo?.userName || approvedUserName || 'operator'}
                </div>
              </div>
            ) : (
              <div className="text-white">
                <div className="font-semibold text-lg">Scan to unlock</div>
                <div className="text-gray-300 text-sm mt-1">
                  Use your phone to scan this code and authorize yourself as the device operator.
                </div>

                {/* Refresh + Manual login */}
                <div className="flex items-center gap-4 mt-3">
                  <button
                    onClick={onRefreshPoll}
                    className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 transition-colors"
                    title="Check for authorization"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>

                  <button
                    onClick={() => setShowManualLogin(!showManualLogin)}
                    className="text-gray-400 hover:text-gray-300 text-xs transition-colors"
                  >
                    {showManualLogin ? 'Hide manual login' : 'Manual login'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Manual login form */}
        {showManualLogin && !exchanging && (
          <ManualLoginForm
            onSuccess={() => {
              setLocked(false);
              onLockStateChange(false);
              resetInactivityTimer();
            }}
          />
        )}
      </div>
    </div>
  );
}

// Inline manual login form for fallback
function ManualLoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // Use NextAuth's signIn with credentials
      const { signIn } = await import('next-auth/react');
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
      } else {
        onSuccess();
      }
    } catch {
      setError('Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto mt-4 pt-4 border-t border-gray-700">
      {error && (
        <div className="text-red-400 text-sm mb-2">{error}</div>
      )}
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="flex-1 bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="flex-1 bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded text-sm font-medium"
        >
          {submitting ? '...' : 'Login'}
        </button>
      </div>
    </form>
  );
}
