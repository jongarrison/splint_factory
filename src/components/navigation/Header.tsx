'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import SignOutButton from '@/components/auth/SignOutButton';

interface HeaderProps {
  variant?: 'browser' | 'electron';
}

export default function Header({ variant = 'browser' }: HeaderProps) {
  const { data: session } = useSession();

  const isDarkMode = variant === 'electron';
  const baseClasses = isDarkMode 
    ? 'bg-gray-800 border-gray-700 text-white' 
    : 'bg-white border-gray-200 text-gray-900';

  return (
    <nav className={`shadow-lg border-b ${baseClasses}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Left side - Logo and brand */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3">
              <h1 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Splint Factory
              </h1>
              {variant === 'electron' && (
                <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                  Desktop
                </span>
              )}
            </Link>
            
            {/* Navigation Links */}
            {session && (
              <div className="hidden md:flex ml-6 space-x-4">
                {variant === 'electron' ? (
                  <>
                    <Link 
                      href="/" 
                      className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} px-3 py-2 text-sm font-medium`}
                    >
                      Print Queue
                    </Link>
                    <Link 
                      href="/" 
                      className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} px-3 py-2 text-sm font-medium`}
                    >
                      Printer Status
                    </Link>
                  </>
                ) : (
                  <>
                    <Link 
                      href="/" 
                      className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} px-3 py-2 text-sm font-medium`}
                    >
                      Design Studio
                    </Link>
                    <Link 
                      href="/" 
                      className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} px-3 py-2 text-sm font-medium`}
                    >
                      My Projects
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right side - User menu */}
          <div className="flex items-center space-x-4">
            {session ? (
              <>
                <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Welcome, {session.user?.name || session.user?.email}!
                </span>
                <Link 
                  href="/profile" 
                  className={`text-sm ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
                >
                  My Profile
                </Link>
                <SignOutButton variant={variant} />
              </>
            ) : (
              <>
                <Link 
                  href="/login" 
                  className={`text-sm ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
                >
                  Sign In
                </Link>
                <Link 
                  href="/register" 
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    isDarkMode 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile menu button - could be expanded later */}
        <div className="md:hidden">
          {/* Mobile navigation would go here */}
        </div>
      </div>
    </nav>
  );
}
