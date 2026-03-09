"use client"

import { Suspense, useState, useEffect, useCallback, useRef } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Header from "@/components/navigation/Header"
import { QRCodeSVG } from "qrcode.react"

// Wrapper to provide Suspense boundary for useSearchParams
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  )
}

function LoginPageInner() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isElectron, setIsElectron] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl")

  // Device auth state (Electron only)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [factoryUrl, setFactoryUrl] = useState<string>("")
  const [challenge, setChallenge] = useState<{ challengeId: string; expiresAt: string } | null>(null)
  const [qrError, setQrError] = useState("")
  const [exchanging, setExchanging] = useState(false)
  const [approvedUser, setApprovedUser] = useState<string | null>(null)
  const challengeRefreshTimer = useRef<NodeJS.Timeout | null>(null)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Detect Electron and get device info
  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api) return
    setIsElectron(true)

    api.getEnvironmentInfo().then((info: any) => {
      setDeviceId(info.deviceId || null)
      setFactoryUrl(info.factoryUrl || "")
    }).catch(() => {})
  }, [])

  // Create a login challenge when we have a deviceId
  const createChallenge = useCallback(async () => {
    if (!deviceId) return
    setQrError("")
    try {
      const hostname = typeof window !== "undefined" ? window.location.hostname : "Unknown"
      const res = await fetch("/api/client-auth/login-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, deviceName: hostname }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setQrError(data.error || "Failed to create QR challenge")
        return
      }
      const data = await res.json()
      setChallenge(data)

      // Auto-refresh before expiry (at 4 minutes)
      if (challengeRefreshTimer.current) clearTimeout(challengeRefreshTimer.current)
      const expiresIn = new Date(data.expiresAt).getTime() - Date.now()
      const refreshIn = Math.max(expiresIn - 60_000, 30_000)
      challengeRefreshTimer.current = setTimeout(createChallenge, refreshIn)
    } catch {
      setQrError("Network error creating QR code")
    }
  }, [deviceId])

  // Start challenge creation once deviceId is available
  useEffect(() => {
    if (!isElectron || !deviceId) return
    createChallenge()
    return () => {
      if (challengeRefreshTimer.current) clearTimeout(challengeRefreshTimer.current)
    }
  }, [isElectron, deviceId, createChallenge])

  // Poll for challenge approval
  useEffect(() => {
    if (!challenge) return

    pollTimer.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/client-auth/${challenge.challengeId}?status=true`, {
          headers: { "X-Device-ID": deviceId || "" },
        })
        if (!res.ok) return
        const data = await res.json()

        if (data.expired) {
          createChallenge()
          return
        }

        if (data.authorizedAt && data.authorizedBy) {
          // Challenge approved -- exchange for session
          setApprovedUser(data.authorizedBy.name || "operator")
          if (pollTimer.current) clearInterval(pollTimer.current)
          exchangeSession(challenge.challengeId)
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000)

    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
  }, [challenge, deviceId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Exchange approved challenge for session cookie
  const exchangeSession = async (challengeId: string) => {
    setExchanging(true)
    try {
      const res = await fetch("/api/client-auth/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, deviceId }),
      })
      if (res.ok) {
        // Full page load so SessionProvider initializes with the new cookie
        window.location.href = "/print-queue"
        return
      }
      const data = await res.json().catch(() => ({}))
      setQrError(data.error || "Failed to exchange session")
    } catch {
      setQrError("Network error during session exchange")
    } finally {
      setExchanging(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Invalid credentials")
      } else {
        // callbackUrl takes priority, then Electron->print-queue, browser->geo-job-menu
        const destination = callbackUrl || (isElectron ? "/print-queue" : "/geo-job-menu")
        // Use full page load so SessionProvider initializes with the new session
        window.location.href = destination
      }
    } catch (err) {
      console.error("Login error:", err)
      setError("An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const qrUrl = challenge ? `${factoryUrl}/client-auth/${challenge.challengeId}` : null

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <Header hideMaintenanceBanner={true} />
      <div className="flex-1 bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
              Sign in to your account
            </h2>
          </div>

          {/* QR code section -- Electron only */}
          {isElectron && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center gap-6">
                {/* QR Code */}
                <div className="flex-shrink-0">
                  {exchanging ? (
                    <div className="w-[152px] h-[152px] flex items-center justify-center bg-gray-700 rounded-lg">
                      <div className="text-center text-white">
                        <div className="text-sm font-medium">Signing in...</div>
                        <div className="text-xs text-gray-300 mt-1">{approvedUser}</div>
                      </div>
                    </div>
                  ) : qrUrl ? (
                    <div className="p-4 rounded-lg" style={{ backgroundColor: '#ffffff' }}>
                      <QRCodeSVG value={qrUrl} size={120} level="M" />
                    </div>
                  ) : (
                    <div className="w-[152px] h-[152px] bg-gray-700 rounded-lg animate-pulse" />
                  )}
                </div>

                {/* Instructions */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white text-lg">Scan to sign in</div>
                  <div className="text-gray-300 text-sm mt-1">
                    Use your phone to scan this QR code and authorize this device.
                  </div>
                  {qrError && (
                    <div className="text-red-400 text-xs mt-2">{qrError}</div>
                  )}
                  {challenge && !exchanging && (
                    <button
                      onClick={createChallenge}
                      className="text-blue-400 hover:text-blue-300 text-xs mt-2 flex items-center gap-1 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh QR code
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-700">
                <p className="text-gray-500 text-xs text-center">
                  Or use the form below to sign in manually
                </p>
              </div>
            </div>
          )}

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm text-center">{error}</div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
