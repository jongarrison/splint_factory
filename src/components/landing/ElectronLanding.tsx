'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function ElectronLanding() {
  const [output, setOutput] = useState<string>('Loading printer status...');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Use useEffect for async operations
  useEffect(() => {
    const getPrinterStatus = async () => {
      try {
        setIsLoading(true);
        
        // Check if we're in an Electron environment
        if (typeof window !== 'undefined' && window.electronAPI) {
          const result = await window.electronAPI.getPrinterStatusInfo();

          if (!result) {
            setOutput('Error receiving printer status');
          } else {
            setOutput(`Printer Status: ${JSON.stringify(result, null, 2)}`);
          }
        } else {
          setOutput('Electron API not available');
        }
      } catch (error) {
        setOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    };

    getPrinterStatus();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">   
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-20 pb-16">
          <h1 className="text-3xl font-bold mb-6">
            Splint Factory - Desktop Application
          </h1>
          <p className="text-gray-300 mb-8">
            Welcome to the professional desktop interface for splint design and manufacturing.
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Link
              href="/login"
              className="bg-blue-600 hover:bg-blue-700 p-6 rounded-lg transition-colors"
            >
              <h3 className="text-lg font-semibold mb-2">Sign In</h3>
              <p className="text-sm text-gray-300">Access your account</p>
            </Link>

            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Print Queue</h3>
              <p className="text-sm text-gray-300">Manage print jobs</p>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Printer Status</h3>
              {isLoading ? (
                <p className="text-sm text-gray-300">Loading...</p>
              ) : (
                <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-auto max-h-32">
                  {output}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
