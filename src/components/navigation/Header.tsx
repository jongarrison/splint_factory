'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import SignOutButton from '@/components/auth/SignOutButton';

interface HeaderProps {
  variant?: 'browser' | 'electron';
  hideMaintenanceBanner?: boolean;
}

export default function Header({ variant = 'browser', hideMaintenanceBanner = false }: HeaderProps) {
  const { data: session } = useSession();
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [processorHealthy, setProcessorHealthy] = useState<boolean | null>(null);
  const [secondsSinceLastPing, setSecondsSinceLastPing] = useState<number>(0);
  const [maintenanceMode, setMaintenanceMode] = useState<{enabled: boolean; message: string | null} | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();



  // Check geometry processor health on mount (SYSTEM_ADMIN only)
  useEffect(() => {
    if (session?.user?.role === 'SYSTEM_ADMIN') {
      fetch('/api/design-processing/processor-health')
        .then(res => res.json())
        .then(data => {
          setProcessorHealthy(data.isHealthy);
          setSecondsSinceLastPing(data.secondsSinceLastPing);
        })
        .catch(() => {
          setProcessorHealthy(null); // Unknown status on error
        });
    }
  }, [session?.user?.role]);

  // Check maintenance mode status for all users
  useEffect(() => {
    fetch('/api/maintenance-status')
      .then(res => res.json())
      .then(data => {
        if (data.maintenanceModeEnabled) {
          setMaintenanceMode({ enabled: true, message: data.maintenanceMessage });
        } else {
          setMaintenanceMode({ enabled: false, message: null });
        }
      })
      .catch(() => {
        setMaintenanceMode(null);
      });
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAdminDropdown(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    if (showAdminDropdown || showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAdminDropdown, showUserDropdown]);

  return (
    <>
      {/* Maintenance Mode Banner (All users) */}
      {!hideMaintenanceBanner && maintenanceMode?.enabled && (
        <div className="bg-[var(--status-warning-bg)] border-b border-[var(--status-warning-text)]/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center gap-2 text-sm text-[var(--status-warning-text)]">
              <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <div className="font-semibold text-base">System Maintenance</div>
                {maintenanceMode.message && (
                  <div className="mt-0.5">{maintenanceMode.message}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Geometry Processor Health Warning (SYSTEM_ADMIN only) */}
      {session?.user?.role === 'SYSTEM_ADMIN' && processorHealthy === false && (
        <div className="bg-[var(--status-warning-bg)] border-b border-[var(--status-warning-text)]/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <div className="flex items-center gap-2 text-sm text-[var(--status-warning-text)]">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Design Processor Offline</span>
              <span>
                Last check-in: {secondsSinceLastPing}s ago
              </span>
            </div>
          </div>
        </div>
      )}
      
      <nav className="shadow-lg border-b bg-[var(--surface)] border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Left side - Logo and brand */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <h1 className="text-xl font-semibold text-primary">
                Splint Factory
              </h1>
            </Link>
            
            {/* About link - visible in browser mode */}
            {variant === 'browser' && (
              <Link
                href="/about"
                className="ml-4 text-sm font-medium text-secondary hover:text-[var(--text-primary)] transition-colors"
              >
                About
              </Link>
            )}

            {/* Create button - only visible in browser mode and not on design-menu page */}
            {variant === 'browser' && session && pathname !== '/design-menu' && (
              <Link
                href="/design-menu"
                className="ml-4 inline-flex items-center px-3 py-1.5 text-sm rounded-md btn-success shadow-sm"
                title="Create New 3D Print"
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
            
            {/* Printer Configuration Icon - Always visible in Electron client */}
            {variant === 'electron' && (
              <Link
                href="/printer/configure"
                className="ml-3 text-link hover:text-[var(--accent-blue-hover)] transition-colors"
                title="Printer Configuration"
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
              </Link>
            )}

            {/* Printer Test Icon - Electron + SYSTEM_ADMIN only */}
            {variant === 'electron' && session?.user?.role === 'SYSTEM_ADMIN' && (
              <Link
                href="/printer/test"
                className="ml-2 text-muted hover:text-[var(--text-primary)] transition-colors"
                title="Printer Test"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.66-5.66a2 2 0 010-2.83l.71-.71a2 2 0 012.83 0l2.12 2.12 2.12-2.12a2 2 0 012.83 0l.71.71a2 2 0 010 2.83l-5.66 5.66z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0 4.14-3.36 7.5-7.5 7.5S4.5 16.14 4.5 12 7.86 4.5 12 4.5s7.5 3.36 7.5 7.5z" />
                </svg>
              </Link>
            )}
            
            {/* Navigation Links */}
            {session && (
              <div className="flex ml-6 space-x-4">
                {variant === 'electron' ? (
                  <>
                    <Link 
                      href="/print-queue" 
                      className="text-secondary hover:text-[var(--text-primary)] px-3 py-2 text-sm font-medium"
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
                          className="text-secondary hover:text-[var(--text-primary)] px-3 py-2 text-sm font-medium flex items-center"
                        >
                          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                          </svg>
                          <span className="hidden sm:inline">Tools</span>
                          <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
{showAdminDropdown && (
                          <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-[var(--surface-secondary)] ring-1 ring-[var(--border)] z-50">
                            <div className="py-1">
                              {/* Organizations - SYSTEM_ADMIN only */}
                              {session?.user?.role === 'SYSTEM_ADMIN' && (
                                <Link
                                  href="/admin/organizations"
                                  onClick={() => setShowAdminDropdown(false)}
                                  className="block px-4 py-2 text-sm text-secondary hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
                                >
                                  Organizations
                                </Link>
                              )}
                              
                              {/* User Management - SYSTEM_ADMIN, ORG_ADMIN */}
                              {(session?.user?.role === 'SYSTEM_ADMIN' || session?.user?.role === 'ORG_ADMIN') && (
                                <Link
                                  href="/admin/users"
                                  onClick={() => setShowAdminDropdown(false)}
                                  className="block px-4 py-2 text-sm text-secondary hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
                                >
                                  User Management
                                </Link>
                              )}
                              
                              {/* Invitations - SYSTEM_ADMIN, ORG_ADMIN */}
                              {(session?.user?.role === 'SYSTEM_ADMIN' || session?.user?.role === 'ORG_ADMIN') && (
                                <Link
                                  href="/admin/invitations"
                                  onClick={() => setShowAdminDropdown(false)}
                                  className="block px-4 py-2 text-sm text-secondary hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
                                >
                                  Invitations
                                </Link>
                              )}
                              
                              {/* Design Definitions - SYSTEM_ADMIN only */}
                              {session?.user?.role === 'SYSTEM_ADMIN' && (
                                <Link
                                  href="/admin/design-definitions"
                                  onClick={() => setShowAdminDropdown(false)}
                                  className="block px-4 py-2 text-sm text-secondary hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
                                >
                                  Design Definitions
                                </Link>
                              )}
                              
                              {/* API Keys - SYSTEM_ADMIN only */}
                              {session?.user?.role === 'SYSTEM_ADMIN' && (
                                <Link
                                  href="/admin/api-keys"
                                  onClick={() => setShowAdminDropdown(false)}
                                  className="block px-4 py-2 text-sm text-secondary hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
                                >
                                  API Keys
                                </Link>
                              )}
                              
                              {/* Geometry Jobs (aka Design Generation Jobs) - All roles */}
                              <Link
                                href="/design-jobs"
                                onClick={() => setShowAdminDropdown(false)}
                                className="block px-4 py-2 text-sm text-secondary hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
                              >
                                Design Jobs
                              </Link>
                              
                              {/* Print Queue - All roles */}
                              <Link
                                href="/print-queue"
                                onClick={() => setShowAdminDropdown(false)}
                                className="block px-4 py-2 text-sm text-secondary hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
                              >
                                Print Queue
                              </Link>
                              {/* System Status - SYSTEM_ADMIN only */}
                              {session?.user?.role === 'SYSTEM_ADMIN' && (
                                <Link
                                  href="/admin"
                                  onClick={() => setShowAdminDropdown(false)}
                                  className="block px-4 py-2 text-sm text-secondary hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
                                >
                                  System Status
                                </Link>
                              )}
                              
                              {/* Link Tracking - SYSTEM_ADMIN only */}
                              {session?.user?.role === 'SYSTEM_ADMIN' && (
                                <Link
                                  href="/admin/links"
                                  onClick={() => setShowAdminDropdown(false)}
                                  className="block px-4 py-2 text-sm text-secondary hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
                                >
                                  Link Tracking
                                </Link>
                              )}
                              
                              {/* Email Admin - SYSTEM_ADMIN only */}
                              {session?.user?.role === 'SYSTEM_ADMIN' && (
                                <Link
                                  href="/admin/email"
                                  onClick={() => setShowAdminDropdown(false)}
                                  className="block px-4 py-2 text-sm text-secondary hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
                                >
                                  Email
                                </Link>
                              )}
                              

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
                <span className="hidden sm:inline text-sm text-muted">
                  Welcome, {session.user?.name || session.user?.email}!
                </span>
                <div className="relative" ref={userDropdownRef}>
                  <button
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="text-link hover:text-[var(--accent-blue-hover)] transition-colors"
                    title="User menu"
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
                  </button>
                  {showUserDropdown && (
                    <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-[var(--surface-secondary)] ring-1 ring-[var(--border)] z-50">
                      <div className="py-1">
                        <Link
                          href="/profile"
                          onClick={() => setShowUserDropdown(false)}
                          className="block px-4 py-2 text-sm text-secondary hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
                        >
                          Profile
                        </Link>
                        {session.user?.organizationId && (session.user?.role === 'SYSTEM_ADMIN' || session.user?.role === 'ORG_ADMIN') && (
                          <Link
                            href={`/admin/organizations/${session.user.organizationId}`}
                            onClick={() => setShowUserDropdown(false)}
                            className="block px-4 py-2 text-sm text-secondary hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
                          >
                            {session.user.organizationName ? `${session.user.organizationName} Settings` : 'Organization Settings'}
                          </Link>
                        )}
                        <div className="border-t border-[var(--border)] my-1"></div>
                        <div
                          onClick={() => setShowUserDropdown(false)}
                          className="block px-4 py-2 text-sm text-secondary hover:bg-[var(--surface)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          <SignOutButton variant={variant} inline />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {variant === 'electron' && <SignOutButton variant={variant} />}
              </>
            ) : (
              <>
                {/* Only show Sign In link if not already on login page */}
                {pathname !== '/login' && (
                  <Link 
                    href="/login" 
                    className="text-sm text-link hover:text-[var(--accent-blue-hover)]"
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
    </>
  );
}
