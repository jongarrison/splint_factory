"use client"

import { signOut } from "next-auth/react"
import { useEffect, useState } from "react"

interface SignOutButtonProps {
  variant?: 'browser' | 'electron';
  inline?: boolean;
}

export default function SignOutButton({ variant = 'browser', inline = false }: SignOutButtonProps) {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Detect if running in Electron environment
    const checkElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
    setIsElectron(checkElectron);
  }, []);
  
  const handleSignOut = async () => {
    await signOut({ redirect: false });
    
    // Full page load ensures the cleared session cookie is sent with the request,
    // avoiding race conditions with middleware auth checks
    if (isElectron) {
      window.location.href = '/login';
    } else {
      window.location.href = '/';
    }
  };

  if (inline) {
    return (
      <button
        onClick={handleSignOut}
        className="w-full text-left"
      >
        Sign Out
      </button>
    );
  }

  return (
    <button
      onClick={handleSignOut}
      className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors"
    >
      Sign Out
    </button>
  )
}
