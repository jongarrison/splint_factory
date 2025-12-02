'use client';

import { useEffect, useState } from 'react';

/**
 * Keyboard Toggle Button Component
 * Only shows in Electron environment (kiosk mode)
 * Allows manually toggling the virtual keyboard visibility
 */
export default function KeyboardToggleButton() {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Only run in Electron environment
    const checkElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
    setIsElectron(checkElectron);
  }, []);

  // Don't render anything if not in Electron
  if (!isElectron) return null;

  const handleToggle = () => {
    // Dispatch custom event that VirtualKeyboard will listen for
    const event = new CustomEvent('toggle-keyboard');
    window.dispatchEvent(event);
  };

  return (
    <button
      onClick={handleToggle}
      className="fixed bottom-4 right-4 z-50 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors"
      title="Toggle keyboard"
      aria-label="Toggle keyboard"
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-6 w-6" 
        fill="currentColor" 
        viewBox="0 0 24 24"
      >
        <rect x="2" y="6" width="20" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="4" y="8" width="2" height="2" rx="0.5"/>
        <rect x="7" y="8" width="2" height="2" rx="0.5"/>
        <rect x="10" y="8" width="2" height="2" rx="0.5"/>
        <rect x="13" y="8" width="2" height="2" rx="0.5"/>
        <rect x="16" y="8" width="2" height="2" rx="0.5"/>
        <rect x="19" y="8" width="2" height="2" rx="0.5"/>
        <rect x="5" y="11" width="2" height="2" rx="0.5"/>
        <rect x="8" y="11" width="2" height="2" rx="0.5"/>
        <rect x="11" y="11" width="2" height="2" rx="0.5"/>
        <rect x="14" y="11" width="2" height="2" rx="0.5"/>
        <rect x="17" y="11" width="2" height="2" rx="0.5"/>
        <rect x="7" y="14" width="10" height="2" rx="0.5"/>
      </svg>
    </button>
  );
}
