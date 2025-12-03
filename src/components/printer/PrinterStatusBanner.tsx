'use client';

import { useState, useEffect } from 'react';

interface PrinterStatus {
  timestamp: number;
  connected: boolean;
  state: 'printing' | 'paused' | 'idle' | 'error';
  printJob: {
    active: boolean;
    filename: string | null;
    progress: number;
    timeRemaining: number;
    layer: number;
    totalLayers: number;
  };
  temperatures: {
    bed: {
      current: number;
      target: number;
    };
    nozzle: {
      current: number;
      target: number;
    };
    chamber: {
      current: number;
    };
  };
  wifi: {
    signal: number;
  };
}

export default function PrinterStatusBanner() {
  const [status, setStatus] = useState<PrinterStatus | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null);
  const [isElectronClient, setIsElectronClient] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    // Check if we're in Electron
    const hasElectronAPI = typeof window !== 'undefined' && !!(window as any).electronAPI;
    setIsElectronClient(hasElectronAPI);

    if (!hasElectronAPI) return;

    const electronAPI = (window as any).electronAPI;

    // Subscribe to printer status updates
    const unsubscribe = electronAPI.printer.subscribeToStatus((newStatus: PrinterStatus) => {
      setStatus(newStatus);
      setLastUpdateTime(Date.now());
      setIsSubscribed(true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Update relative time every second
  useEffect(() => {
    if (!lastUpdateTime) return;

    const interval = setInterval(() => {
      // Force re-render to update relative time
      setLastUpdateTime(prevTime => prevTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [lastUpdateTime]);

  if (!isElectronClient) {
    return null; // Don't show in browser
  }

  if (!isSubscribed || !status) {
    return (
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gray-400"></div>
          <span className="text-sm text-gray-300">Connecting to printer...</span>
        </div>
      </div>
    );
  }

  if (!status.connected) {
    return (
      <div className="bg-red-50 border border-red-300 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500"></div>
          <span className="text-sm text-red-700 font-medium">Printer Offline</span>
        </div>
      </div>
    );
  }

  const formatTimeRemaining = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getUpdateTime = () => {
    if (!lastUpdateTime) return '';
    const date = new Date(lastUpdateTime);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const getStateColor = () => {
    switch (status.state) {
      case 'printing': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'idle': return 'bg-blue-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStateLabel = () => {
    switch (status.state) {
      case 'printing': return 'Printing';
      case 'paused': return 'Paused';
      case 'idle': return 'Idle';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 mb-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        {/* Left side: Status indicator and main info */}
        <div className="flex items-start gap-3 flex-1">
          <div className="flex items-center gap-2 min-w-[80px]">
            <div className={`w-2 h-2 rounded-full ${getStateColor()}`}></div>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{getStateLabel()}</span>
          </div>

          {status.printJob.active && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {status.printJob.filename || 'Unknown file'}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {status.printJob.progress.toFixed(1)}%
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Layer {status.printJob.layer}/{status.printJob.totalLayers}
                </span>
                {status.printJob.timeRemaining > 0 && (
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {formatTimeRemaining(status.printJob.timeRemaining)} remaining
                  </span>
                )}
              </div>
              {/* Progress bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
                <div 
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${status.printJob.progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {!status.printJob.active && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Ready for printing
            </div>
          )}
        </div>

        {/* Right side: Temperatures and data age */}
        <div className="flex items-start gap-4 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex gap-3">
            <div title="Nozzle temperature" className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
              </svg>
              {status.temperatures.nozzle.current.toFixed(0)}°
              {status.temperatures.nozzle.target > 0 && (
                <span className="text-gray-400 dark:text-gray-500">/{status.temperatures.nozzle.target.toFixed(0)}°</span>
              )}
            </div>
            <div title="Bed temperature" className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <rect x="2" y="11" width="20" height="2" />
                <rect x="4" y="14" width="16" height="6" rx="1" />
              </svg>
              {status.temperatures.bed.current.toFixed(0)}°
              {status.temperatures.bed.target > 0 && (
                <span className="text-gray-400 dark:text-gray-500">/{status.temperatures.bed.target.toFixed(0)}°</span>
              )}
            </div>
          </div>
          <div className="text-gray-400 dark:text-gray-500 whitespace-nowrap" title={`Last updated: ${new Date(lastUpdateTime || 0).toLocaleString()}`}>
            {getUpdateTime()}
          </div>
        </div>
      </div>
    </div>
  );
}
