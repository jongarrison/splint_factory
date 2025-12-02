"use client"

import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"

interface SignOutButtonProps {
  variant?: 'browser' | 'electron';
}

export default function SignOutButton({ variant = 'browser' }: SignOutButtonProps) {
  const router = useRouter()
  
  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  return (
    <button
      onClick={handleSignOut}
      className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors"
    >
      Sign Out
    </button>
  )
}
