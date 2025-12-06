'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import SignOutButton from '@/components/auth/SignOutButton';

interface HeaderProps {
  variant?: 'browser' | 'electron';
}

export default function Header({ variant = 'browser' }: HeaderProps) {
  const { data: session } = useSession();
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

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
            <Link href="/" className="flex items-center">
              <h1 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Splint Factory
              </h1>
            </Link>
            
            {/* Create button - only visible in browser mode and not on geo-job-menu page */}
            {variant === 'browser' && session && pathname !== '/geo-job-menu' && (
              <Link
                href="/geo-job-menu"
                className="ml-4 inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors shadow-sm"
                title="Create new splint"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  strokeWidth={2} 
                  stroke="currentColor" 
                  className="w-4 h-4 mr-1"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create
              </Link>
            )}
            
            {/* Printer Status Icon - Always visible in Electron client */}
            {variant === 'electron' && (
              <button
                onClick={() => {
                  // Open the local printer manager via Electron API
                  if (typeof window !== 'undefined' && (window as any).electronAPI) {
                    (window as any).electronAPI.executeCommand('printer-manager', []);
                  }
                }}
                className={`ml-3 ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} transition-colors`}
                title="Printer Status"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  strokeWidth={2} 
                  stroke="currentColor" 
                  className="w-8 h-8"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" 
                  />
                </svg>
              </button>
            )}
            
            {/* Navigation Links */}
            {session && (
              <div className="flex ml-6 space-x-4">
                {variant === 'electron' ? (
                  <>
                    <Link 
                      href="/admin/print-queue" 
                      className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} px-3 py-2 text-sm font-medium`}
                    >
                      Print Queue
                    </Link>
                  </>
                ) : (
                  <>
                    {/* Admin Dropdown - Show in browser version, always visible */}
                    {variant === 'browser' && (
                      <div className="relative" ref={dropdownRef}>
                        <button
                          onClick={() => setShowAdminDropdown(!showAdminDropdown)}
                          className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} px-3 py-2 text-sm font-medium flex items-center`}
                        >
                          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="hidden sm:inline">Admin</span>
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
                              <Link
                                href="/admin/geometry-jobs"
                                onClick={() => setShowAdminDropdown(false)}
                                className={`block px-4 py-2 text-sm ${isDarkMode ? 'text-gray-300 hover:bg-gray-600 hover:text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                              >
                                Splint Geometry Jobs
                              </Link>
                              <Link
                                href="/admin/print-queue"
                                onClick={() => setShowAdminDropdown(false)}
                                className={`block px-4 py-2 text-sm ${isDarkMode ? 'text-gray-300 hover:bg-gray-600 hover:text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                              >
                                Print Queue
                              </Link>
                              <div className={`border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'} my-1`}></div>
                              <div
                                onClick={() => setShowAdminDropdown(false)}
                                className={`block px-4 py-2 text-sm ${isDarkMode ? 'text-gray-300 hover:bg-gray-600 hover:text-white' : 'text-gray-700 hover:bg-gray-100'} cursor-pointer`}
                              >
                                <SignOutButton variant={variant} inline />
                              </div>
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
                <span className={`hidden sm:inline text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Welcome, {session.user?.name || session.user?.email}!
                </span>
                <Link 
                  href="/profile" 
                  className={`${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'} transition-colors`}
                  title="My Profile"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    strokeWidth={2} 
                    stroke="currentColor" 
                    className="w-8 h-8"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" 
                    />
                  </svg>
                </Link>
                {variant === 'electron' && <SignOutButton variant={variant} />}
              </>
            ) : (
              <>
                {/* Only show Sign In link if not already on login page */}
                {pathname !== '/login' && (
                  <Link 
                    href="/login" 
                    className={`text-sm ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
                  >
                    Sign In
                  </Link>
                )}
                {/* Get Started button removed - registration is invite-only */}
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
