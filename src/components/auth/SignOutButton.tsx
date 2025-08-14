"use client"

import { signOut } from "next-auth/react"

interface SignOutButtonProps {
  variant?: 'browser' | 'electron';
}

export default function SignOutButton({ variant = 'browser' }: SignOutButtonProps) {
  return (
    <button
      onClick={() => signOut()}
      className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors"
    >
      Sign Out
    </button>
  )
}
