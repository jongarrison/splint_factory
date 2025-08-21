'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import Header from '@/components/navigation/Header';

export default function ElectronLanding() {
  const [output, setOutput] = useState<string>('Loading printer status...');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [systemInfo, setSystemInfo] = useState<string>('');

  // Function to open printer configuration
  const openPrinterConfig = async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        // Use console.log to communicate with Electron main process
        console.log('ELECTRON_COMMAND: navigate-to-config');
        
        // Fallback: try using executeCommand to trigger navigation
        try {
          await window.electronAPI.executeCommand('configure-printer');
        } catch (error) {
          console.error('Fallback navigation failed:', error);
        }
      }
    } catch (error) {
      console.error('Failed to open printer configuration:', error);
    }
  };

  // Function to get printer status
  const getPrinterStatus = async () => {
    try {
      setIsLoading(true);
      
      // Check if we're in an Electron environment
      if (typeof window !== 'undefined' && window.electronAPI) {
        // First, try to load saved printer configuration
        const configResult = await window.electronAPI.loadPrinterConfig();
        
        if (!configResult || !configResult.success) {
          setOutput(`No printer configuration found.\nPlease use Ctrl+P (or Cmd+P) to configure your printer first.\n\nError: ${configResult?.error || 'Configuration file not found'}`);
          return;
        }

        const printerConfig = configResult.config;
        console.log('Using saved printer configuration:', printerConfig);

        // Get printer status using the loaded configuration
        const result = await window.electronAPI.getPrinterStatusInfo(printerConfig);

        if (!result || !result.success) {
          if (result?.needsConfiguration) {
            setOutput(`Printer configuration incomplete.\nPlease use Ctrl+P (or Cmd+P) to reconfigure your printer.\n\nError: ${result?.error || 'Configuration validation failed'}`);
          } else {
            setOutput(`Error: ${result?.error || 'Failed to connect to printer'}\n\nTip: Check if printer is on the same network and accessible at ${printerConfig?.host || 'configured IP'}`);
          }
        } else {
          // Display formatted printer status information
          const model = printerConfig?.model || 'Unknown';
          const host = printerConfig?.host || 'Unknown';
          setOutput(`Printer Status (${model} at ${host}):\n${JSON.stringify(result, null, 2)}`);
        }
      } else {
        setOutput('Electron API not available - running in browser mode');
      }
    } catch (error) {
      setOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to get system information
  const getSystemInfo = async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const info = await window.electronAPI.getEnvironmentInfo();
        setSystemInfo(`System: ${info.platform} ${info.arch}\nHostname: ${info.hostname}\nMemory: ${(info.totalmem / (1024**3)).toFixed(1)}GB`);
      }
    } catch (error) {
      setSystemInfo(`Error getting system info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Use useEffect for initial load and keyboard shortcuts
  useEffect(() => {
    getPrinterStatus();
    getSystemInfo();

    // Add keyboard shortcut listener
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ctrl+P or Cmd+P to open printer configuration
      if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
        event.preventDefault();
        openPrinterConfig();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header variant="electron" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-8 pb-16">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">
                Desktop Control Center
              </h1>
              <p className="text-gray-300 mt-2">
                Professional desktop interface for 3D printer management and monitoring.
              </p>
            </div>
            <button 
              onClick={openPrinterConfig}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              title="Configure Printer (Ctrl+P)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Configure Printer
            </button>
          </div>
          
          <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Print Queue</h3>
              <p className="text-sm text-gray-300">Manage print jobs</p>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Printer Status</h3>
              {isLoading ? (
                <p className="text-sm text-gray-300">Loading...</p>
              ) : (
                <>
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-auto max-h-32 mb-3">
                    {output}
                  </pre>
                  <button 
                    onClick={getPrinterStatus}
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-3 py-1 rounded text-sm"
                  >
                    Refresh Status
                  </button>
                </>
              )}
            </div>

            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">System Info</h3>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                {systemInfo || 'Loading system info...'}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
