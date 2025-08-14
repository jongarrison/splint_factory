'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import Header from '@/components/navigation/Header';

export default function ElectronLanding() {
  const [output, setOutput] = useState<string>('Loading printer status...');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [systemInfo, setSystemInfo] = useState<string>('');

  // Function to get printer status
  const getPrinterStatus = async () => {
    try {
      setIsLoading(true);
      
      // Check if we're in an Electron environment
      if (typeof window !== 'undefined' && window.electronAPI) {
        // Example printer configuration - in real usage this would come from user settings
        const printerConfig = {
          model: "P1S",                      // Printer model (P1S, P1P, X1C, A1, etc.)
          host: "192.168.1.100",            // IP address of the printer on local network
          accessCode: "your-access-code",   // Access code from printer settings
          serial: "printer-serial-number"   // Unique serial number
        };

        const result = await window.electronAPI.getPrinterStatusInfo(printerConfig);

        if (!result || !result.success) {
          setOutput(`Error: ${result?.error || 'Failed to get printer status'}`);
        } else {
          // Display formatted printer status information
          setOutput(`Printer Status (${printerConfig.model}):\n${JSON.stringify(result, null, 2)}`);
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

  // Use useEffect for initial load
  useEffect(() => {
    getPrinterStatus();
    getSystemInfo();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header variant="electron" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-8 pb-16">
          <h1 className="text-3xl font-bold mb-6">
            Desktop Control Center
          </h1>
          <p className="text-gray-300 mb-8">
            Professional desktop interface for 3D printer management and monitoring.
          </p>
          
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
