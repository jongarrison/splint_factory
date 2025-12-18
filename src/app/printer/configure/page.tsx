'use client';

import { useState, useEffect, useRef } from 'react';

// TypeScript interfaces
interface PrinterConfig {
  model: string;
  host: string;
  accessCode: string;
  serial: string;
}

interface StatusMessage {
  message: string;
  type: 'info' | 'success' | 'error';
}

interface PrinterStatus {
  connected: boolean;
  state: string;
  printJob: {
    active: boolean;
    filename?: string;
    progress: number;
    layer: number;
    totalLayers: number;
    timeRemaining: number;
  };
  temperatures: {
    nozzle: { current: number; target: number };
    bed: { current: number; target: number };
    chamber?: { current: number };
  };
  wifi: {
    signal: number;
  };
  ams?: {
    available: boolean;
    currentSlot: number;
    slots: Array<{
      slot: number;
      loaded: boolean;
      material?: string;
      color?: string;
    }>;
  };
}

export default function PrinterConfigurePage() {
  const [activeTab, setActiveTab] = useState<'config' | 'status' | 'print' | 'cache'>('config');
  const [config, setConfig] = useState<PrinterConfig>({
    model: 'P1S',
    host: '',
    accessCode: '',
    serial: '',
  });
  const [configStatus, setConfigStatus] = useState<StatusMessage | null>(null);
  const [statusDisplay, setStatusDisplay] = useState<StatusMessage | null>(null);
  const [fileInfo, setFileInfo] = useState<StatusMessage | null>(null);
  const [printStatus, setPrintStatus] = useState<StatusMessage | null>(null);
  const [cacheInfo, setCacheInfo] = useState<StatusMessage | null>(null);
  
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [factoryUrl, setFactoryUrl] = useState<string>('Loading...');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<PrinterStatus | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [dataAge, setDataAge] = useState<string>('');
  
  const streamUnsubscribeRef = useRef<(() => void) | null>(null);
  const dataAgeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

  // Load environment info and saved config on mount
  useEffect(() => {
    if (isElectron) {
      // Load factory URL
      (window as any).electronAPI.getEnvironmentInfo().then((info: any) => {
        setFactoryUrl(info.factoryUrl);
      }).catch((err: Error) => {
        console.error('Failed to load environment info:', err);
        setFactoryUrl('Error loading');
      });

      // Auto-load saved configuration
      (window as any).electronAPI.loadPrinterConfig().then((result: any) => {
        if (result.success) {
          setConfig(result.config);
          console.log('Auto-loaded saved printer configuration');
        }
      }).catch((err: Error) => {
        console.log('No saved configuration found');
      });
    }
  }, [isElectron]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamUnsubscribeRef.current) {
        streamUnsubscribeRef.current();
      }
      if (dataAgeIntervalRef.current) {
        clearInterval(dataAgeIntervalRef.current);
      }
    };
  }, []);

  // Update data age display
  useEffect(() => {
    if (isStreaming && lastUpdate) {
      dataAgeIntervalRef.current = setInterval(() => {
        const ageSeconds = Math.floor((Date.now() - lastUpdate) / 1000);
        let ageText: string;
        
        if (ageSeconds < 5) {
          ageText = 'just now';
        } else if (ageSeconds < 60) {
          ageText = `${ageSeconds}s ago`;
        } else {
          const ageMinutes = Math.floor(ageSeconds / 60);
          if (ageMinutes < 60) {
            ageText = `${ageMinutes}m ago`;
          } else {
            const ageHours = Math.floor(ageMinutes / 60);
            ageText = `${ageHours}h ago`;
          }
        }
        setDataAge(ageText);
      }, 1000);

      return () => {
        if (dataAgeIntervalRef.current) {
          clearInterval(dataAgeIntervalRef.current);
        }
      };
    }
  }, [isStreaming, lastUpdate]);

  // Configuration functions
  const savePrinterConfig = async () => {
    if (!config.accessCode) {
      setConfigStatus({ message: 'Access code is required', type: 'error' });
      return;
    }
    if (!config.serial) {
      setConfigStatus({ message: 'Serial number is required', type: 'error' });
      return;
    }

    try {
      setConfigStatus({ message: 'Saving configuration...', type: 'info' });
      const result = await (window as any).electronAPI.savePrinterConfig(config);
      
      if (result.success) {
        setConfigStatus({ message: `Configuration saved successfully to ${result.path}`, type: 'success' });
      } else {
        setConfigStatus({ message: `Failed to save: ${result.error}`, type: 'error' });
      }
    } catch (error) {
      setConfigStatus({ message: `Error: ${(error as Error).message}`, type: 'error' });
    }
  };

  const loadPrinterConfig = async () => {
    try {
      setConfigStatus({ message: 'Loading configuration...', type: 'info' });
      const result = await (window as any).electronAPI.loadPrinterConfig();
      
      if (result.success) {
        setConfig(result.config);
        setConfigStatus({ message: `Configuration loaded from ${result.path}`, type: 'success' });
      } else {
        setConfigStatus({ message: result.error, type: 'error' });
      }
    } catch (error) {
      setConfigStatus({ message: `Error: ${(error as Error).message}`, type: 'error' });
    }
  };

  const deletePrinterConfig = async () => {
    if (!confirm('Are you sure you want to delete the saved printer configuration?')) {
      return;
    }

    try {
      setConfigStatus({ message: 'Deleting configuration...', type: 'info' });
      const result = await (window as any).electronAPI.deletePrinterConfig();
      
      if (result.success) {
        setConfig({ model: 'P1S', host: '', accessCode: '', serial: '' });
        setConfigStatus({ message: 'Configuration deleted successfully', type: 'success' });
      } else {
        setConfigStatus({ message: result.error, type: 'error' });
      }
    } catch (error) {
      setConfigStatus({ message: `Error: ${(error as Error).message}`, type: 'error' });
    }
  };

  // Status streaming functions
  const startStatusStreaming = async () => {
    if (streamUnsubscribeRef.current) {
      console.log('Already streaming');
      return;
    }

    try {
      setStatusDisplay({ message: 'Starting live printer stream...', type: 'info' });
      
      streamUnsubscribeRef.current = (window as any).electronAPI.printer.subscribeToStatus((status: PrinterStatus) => {
        setLastUpdate(Date.now());
        setCurrentStatus(status);
        setIsStreaming(true);
      });
    } catch (error) {
      setStatusDisplay({ message: `Error starting stream: ${(error as Error).message}`, type: 'error' });
    }
  };

  const stopStatusStreaming = () => {
    if (streamUnsubscribeRef.current) {
      streamUnsubscribeRef.current();
      streamUnsubscribeRef.current = null;
    }

    if (dataAgeIntervalRef.current) {
      clearInterval(dataAgeIntervalRef.current);
      dataAgeIntervalRef.current = null;
    }

    setIsStreaming(false);
    setCurrentStatus(null);
    setLastUpdate(null);
    setStatusDisplay({ message: 'Live streaming stopped', type: 'info' });
  };

  // Print functions
  const selectFile = async () => {
    try {
      const result = await (window as any).electronAPI.printing.selectPrintFile();
      
      if (result.success && !result.canceled) {
        setSelectedFilePath(result.filePath);
        const fileName = result.filePath.split('/').pop();
        setFileInfo({ 
          message: `Selected: ${fileName}\n${result.filePath}`, 
          type: 'success' 
        });
      } else if (result.canceled) {
        setFileInfo({ message: 'File selection canceled', type: 'info' });
      }
    } catch (error) {
      setFileInfo({ message: `Error: ${(error as Error).message}`, type: 'error' });
    }
  };

  const printFile = async () => {
    if (!selectedFilePath) {
      setPrintStatus({ message: 'Please select a file first', type: 'error' });
      return;
    }

    try {
      const fileName = selectedFilePath.split('/').pop() || 'unknown';
      const jobName = fileName.replace(/\.[^/.]+$/, '');
      
      setPrintStatus({ message: 'Uploading file and starting print...', type: 'info' });
      
      const result = await (window as any).electronAPI.printing.printFromLocal(selectedFilePath, jobName);
      
      if (result.success) {
        setPrintStatus({ 
          message: `Print started successfully!\nJob Name: ${result.jobName}\nFile: ${result.remoteFileName}`, 
          type: 'success' 
        });
      } else {
        setPrintStatus({ message: `Print failed: ${result.error}`, type: 'error' });
      }
    } catch (error) {
      setPrintStatus({ message: `Error: ${(error as Error).message}`, type: 'error' });
    }
  };

  // Cache functions
  const listCache = async () => {
    try {
      setCacheInfo({ message: 'Loading cache contents...', type: 'info' });
      
      const result = await (window as any).electronAPI.printing.listCachedFiles();
      
      if (result.success) {
        if (result.files.length === 0) {
          setCacheInfo({ message: 'Cache is empty', type: 'info' });
        } else {
          setCacheInfo({ 
            message: `Found ${result.count} file(s) in cache`, 
            type: 'success' 
          });
        }
      } else {
        setCacheInfo({ message: `Error: ${result.error}`, type: 'error' });
      }
    } catch (error) {
      setCacheInfo({ message: `Error: ${(error as Error).message}`, type: 'error' });
    }
  };

  const clearCache = async () => {
    if (!confirm('Are you sure you want to clear all cached print files?')) {
      return;
    }

    try {
      setCacheInfo({ message: 'Clearing cache...', type: 'info' });
      
      const result = await (window as any).electronAPI.printing.clearPrintCache();
      
      if (result.success) {
        setCacheInfo({ message: `Cleared ${result.deletedCount || 0} file(s) from cache`, type: 'success' });
      } else {
        setCacheInfo({ message: `Error: ${result.error}`, type: 'error' });
      }
    } catch (error) {
      setCacheInfo({ message: `Error: ${(error as Error).message}`, type: 'error' });
    }
  };

  // Status message component
  const StatusMessage = ({ status }: { status: StatusMessage | null }) => {
    if (!status) return null;
    
    const colors = {
      info: 'bg-blue-100 border-blue-400 text-blue-700',
      success: 'bg-green-100 border-green-400 text-green-700',
      error: 'bg-red-100 border-red-400 text-red-700',
    };

    return (
      <div className={`border-l-4 p-4 mt-4 ${colors[status.type]}`}>
        <p className="whitespace-pre-wrap">{status.message}</p>
      </div>
    );
  };

  // Show warning if not in Electron
  if (!isElectron) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-10 h-10 text-yellow-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <h1 className="text-3xl font-bold text-gray-800">Electron Required</h1>
          </div>
          <p className="text-gray-600">
            This page provides direct printer configuration and management functionality that requires
            the Electron client application. Please access this page through the splint_client Electron app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
          </svg>
          <div>
            <h1 className="text-3xl font-bold">Printer Manager</h1>
            <p className="text-gray-400 mt-1">Configure and manage your Bambu Lab printer</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 mb-6 border-b border-gray-700">
          {(['config', 'status', 'print', 'cache'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'cache') listCache();
              }}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === tab
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Config Tab */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Environment Information</h2>
              <div>
                <strong>SplintFactory URL:</strong>{' '}
                <span className="font-mono text-gray-400">{factoryUrl}</span>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Printer Configuration</h2>
              <p className="text-sm text-gray-400 mb-4">
                <strong>Auto-Discovery:</strong> Your printer&apos;s IP address will be automatically discovered on your local network.
                The serial number is required for authentication with the printer.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Serial Number: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={config.serial}
                    onChange={(e) => setConfig({ ...config, serial: e.target.value })}
                    placeholder="01P00C540201537"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                  <small className="text-gray-400">Required for printer authentication</small>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Access Code: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={config.accessCode}
                    onChange={(e) => setConfig({ ...config, accessCode: e.target.value })}
                    placeholder="12345678"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                  <small className="text-gray-400">8-digit code from Settings → Network on your printer</small>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Printer Model:</label>
                  <input
                    type="text"
                    value={config.model}
                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                    placeholder="P1S, X1C, A1, etc."
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                  <small className="text-gray-400">Optional - will be detected automatically</small>
                </div>

                <details className="mt-4">
                  <summary className="cursor-pointer font-semibold text-gray-300">
                    Advanced: Manual IP Override
                  </summary>
                  <div className="mt-4">
                    <label className="block text-sm font-medium mb-2">IP Address (Optional):</label>
                    <input
                      type="text"
                      value={config.host}
                      onChange={(e) => setConfig({ ...config, host: e.target.value })}
                      placeholder="Leave empty for auto-discovery"
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                    />
                    <small className="text-gray-400">Only set this if auto-discovery fails</small>
                  </div>
                </details>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={savePrinterConfig}
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-semibold flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z"/>
                  </svg>
                  Save Configuration
                </button>
                <button
                  onClick={loadPrinterConfig}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-semibold flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                  </svg>
                  Load Configuration
                </button>
                <button
                  onClick={deletePrinterConfig}
                  className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-semibold flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  Delete Configuration
                </button>
              </div>

              <StatusMessage status={configStatus} />
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">How to Find Your Printer Information</h2>
              <p className="text-sm text-gray-400 space-y-2">
                <strong>Serial Number (Required):</strong> Located on a sticker on your printer, in BambuStudio Device settings, or Settings → Device on your printer&apos;s screen<br />
                <strong>Access Code (Required):</strong> Go to Settings → Network on your printer&apos;s screen to view the 8-digit code<br />
                <strong>Printer Model:</strong> Optional - will be auto-detected from the printer during connection
              </p>
            </div>
          </div>
        )}

        {/* Status Tab */}
        {activeTab === 'status' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Live Printer Status</h2>
              <div className="flex space-x-3 mb-4">
                <button
                  onClick={startStatusStreaming}
                  disabled={isStreaming}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded font-semibold flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
                  </svg>
                  Start Live Streaming
                </button>
                <button
                  onClick={stopStatusStreaming}
                  disabled={!isStreaming}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-4 py-2 rounded font-semibold flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  Stop Streaming
                </button>
              </div>

              {isStreaming && currentStatus && (
                <div className="space-y-4">
                  <div className="bg-green-900 border border-green-700 rounded p-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                    Live Stream Active • {dataAge}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-700 rounded p-4">
                      <h4 className="font-bold mb-2">Printer State</h4>
                      <p><strong>Status:</strong> <span className="capitalize">{currentStatus.state}</span></p>
                      <p><strong>Active Job:</strong> {currentStatus.printJob.active ? 'Yes' : 'No'}</p>
                    </div>

                    <div className="bg-gray-700 rounded p-4">
                      <h4 className="font-bold mb-2">Temperatures</h4>
                      <p><strong>Nozzle:</strong> {currentStatus.temperatures.nozzle.current.toFixed(0)}°C / {currentStatus.temperatures.nozzle.target}°C</p>
                      <p><strong>Bed:</strong> {currentStatus.temperatures.bed.current.toFixed(0)}°C / {currentStatus.temperatures.bed.target}°C</p>
                    </div>
                  </div>

                  {currentStatus.printJob.active && (
                    <div className="bg-gray-700 rounded p-4">
                      <h4 className="font-bold mb-2">Print Progress</h4>
                      <div className="w-full bg-gray-600 rounded-full h-4 mb-2">
                        <div
                          className="bg-blue-500 h-4 rounded-full"
                          style={{ width: `${currentStatus.printJob.progress}%` }}
                        />
                      </div>
                      <p>{currentStatus.printJob.progress.toFixed(1)}% • Layer {currentStatus.printJob.layer}/{currentStatus.printJob.totalLayers}</p>
                    </div>
                  )}
                </div>
              )}

              {!isStreaming && <StatusMessage status={statusDisplay} />}
            </div>
          </div>
        )}

        {/* Print Tab */}
        {activeTab === 'print' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Select Print File</h2>
              <button
                onClick={selectFile}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-semibold flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                </svg>
                Choose 3MF File
              </button>
              <StatusMessage status={fileInfo} />
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Print Actions</h2>
              <button
                onClick={printFile}
                disabled={!selectedFilePath}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded font-semibold flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                </svg>
                Upload & Print
              </button>
              <StatusMessage status={printStatus} />
            </div>
          </div>
        )}

        {/* Cache Tab */}
        {activeTab === 'cache' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Print Cache Management</h2>
              <p className="text-sm text-gray-400 mb-4">
                Cached files are stored locally in <code>~/.splint_client/print_cache</code>
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={listCache}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-semibold flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
                  </svg>
                  List Cache Files
                </button>
                <button
                  onClick={clearCache}
                  className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-semibold flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  Clear All Cache
                </button>
              </div>
              <StatusMessage status={cacheInfo} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
