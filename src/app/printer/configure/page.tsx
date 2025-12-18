'use client';

import { useState, useEffect, useRef } from 'react';

// TypeScript interfaces
interface PrinterConfig {
  name: string;
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
    name: '',
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
        setConfig({ name: '', model: 'P1S', host: '', accessCode: '', serial: '' });
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
          <h1 className="text-3xl font-bold text-gray-800 mb-4">⚠️ Electron Required</h1>
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold">🖨️ Printer Manager</h1>
          <p className="text-gray-400 mt-2">Configure and manage your Bambu Lab printer</p>
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
                  <label className="block text-sm font-medium mb-2">Device Name (Optional):</label>
                  <input
                    type="text"
                    value={config.name}
                    onChange={(e) => setConfig({ ...config, name: e.target.value })}
                    placeholder="Bambi-3DP-01P-537"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                  <small className="text-gray-400">Only needed if you have multiple printers</small>
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
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-semibold"
                >
                  💾 Save Configuration
                </button>
                <button
                  onClick={loadPrinterConfig}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-semibold"
                >
                  📂 Load Configuration
                </button>
                <button
                  onClick={deletePrinterConfig}
                  className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-semibold"
                >
                  🗑️ Delete Configuration
                </button>
              </div>

              <StatusMessage status={configStatus} />
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">How to Find Your Printer Information</h2>
              <p className="text-sm text-gray-400 space-y-2">
                <strong>Serial Number (Required):</strong> Located on a sticker on your printer, in BambuStudio Device settings, or Settings → Device on your printer&apos;s screen<br />
                <strong>Device Name (Optional):</strong> Only needed if you have multiple printers. Check Settings → General → Device Name on your printer&apos;s screen<br />
                <strong>Access Code (Required):</strong> Go to Settings → Network on your printer&apos;s screen to view the 8-digit code
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
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded font-semibold"
                >
                  ▶️ Start Live Streaming
                </button>
                <button
                  onClick={stopStatusStreaming}
                  disabled={!isStreaming}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-4 py-2 rounded font-semibold"
                >
                  ⏹️ Stop Streaming
                </button>
              </div>

              {isStreaming && currentStatus && (
                <div className="space-y-4">
                  <div className="bg-green-900 border border-green-700 rounded p-3">
                    ✓ Live Stream Active • {dataAge}
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
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-semibold"
              >
                📁 Choose 3MF File
              </button>
              <StatusMessage status={fileInfo} />
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Print Actions</h2>
              <button
                onClick={printFile}
                disabled={!selectedFilePath}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded font-semibold"
              >
                🚀 Upload & Print
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
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-semibold"
                >
                  📋 List Cache Files
                </button>
                <button
                  onClick={clearCache}
                  className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-semibold"
                >
                  🗑️ Clear All Cache
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
