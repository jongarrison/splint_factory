"use client"

import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface SignOutButtonProps {
  variant?: 'browser' | 'electron';
  inline?: boolean;
}

export default function SignOutButton({ variant = 'browser', inline = false }: SignOutButtonProps) {
  const router = useRouter()
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Detect if running in Electron environment
    const checkElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
    setIsElectron(checkElectron);
  }, []);
  
  const handleSignOut = async () => {
    await signOut({ redirect: false });
    
    if (isElectron) {
      // In Electron, use client-side navigation to avoid opening external browser
      router.push('/login');
    } else {
      // In browser, force a full page reload to clear all state
      window.location.href = '/login';
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
