'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useRef } from 'react';
import SignOutButton from '@/components/auth/SignOutButton';

interface HeaderProps {
  variant?: 'browser' | 'electron';
}

export default function Header({ variant = 'browser' }: HeaderProps) {
  const { data: session } = useSession();
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isDarkMode = variant === 'electron';
  const baseClasses = isDarkMode 
    ? 'bg-gray-800 border-gray-700 text-white' 
    : 'bg-white border-gray-200 text-gray-900';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAdminDropdown(false);
      }
    };

    if (showAdminDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAdminDropdown]);

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
                    
                    {/* Admin Dropdown - Phase 2: Only show in browser version */}
                    {variant === 'browser' && (
                      <div className="relative" ref={dropdownRef}>
                        <button
                          onClick={() => setShowAdminDropdown(!showAdminDropdown)}
                          className={`${isDarkMode ? 'text-yellow-400 hover:text-yellow-300' : 'text-orange-600 hover:text-orange-800'} px-3 py-2 text-sm font-medium flex items-center`}
                        >
                          Management
                          <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {showAdminDropdown && (
                          <div className={`absolute right-0 mt-2 w-56 rounded-md shadow-lg ${isDarkMode ? 'bg-gray-700 ring-gray-600' : 'bg-white ring-black'} ring-1 ring-opacity-5 z-50`}>
                            <div className="py-1">
                              <Link
                                href="/admin"
                                onClick={() => setShowAdminDropdown(false)}
                                className={`block px-4 py-2 text-sm ${isDarkMode ? 'text-gray-300 hover:bg-gray-600 hover:text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                              >
                                Organizations
                              </Link>
                              <Link
                                href="/admin/users"
                                onClick={() => setShowAdminDropdown(false)}
                                className={`block px-4 py-2 text-sm ${isDarkMode ? 'text-gray-300 hover:bg-gray-600 hover:text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                              >
                                User Management
                              </Link>
                              <Link
                                href="/admin/invitations"
                                onClick={() => setShowAdminDropdown(false)}
                                className={`block px-4 py-2 text-sm ${isDarkMode ? 'text-gray-300 hover:bg-gray-600 hover:text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                              >
                                Invitations
                              </Link>
                              <Link
                                href="/admin/named-geometry"
                                onClick={() => setShowAdminDropdown(false)}
                                className={`block px-4 py-2 text-sm ${isDarkMode ? 'text-gray-300 hover:bg-gray-600 hover:text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                              >
                                Named Geometry Designs
                              </Link>
                              <Link
                                href="/admin/api-keys"
                                onClick={() => setShowAdminDropdown(false)}
                                className={`block px-4 py-2 text-sm ${isDarkMode ? 'text-gray-300 hover:bg-gray-600 hover:text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                              >
                                API Keys
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
