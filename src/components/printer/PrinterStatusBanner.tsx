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
            <div title="Nozzle temperature">
              🔥 {status.temperatures.nozzle.current.toFixed(0)}°
              {status.temperatures.nozzle.target > 0 && (
                <span className="text-gray-400 dark:text-gray-500">/{status.temperatures.nozzle.target.toFixed(0)}°</span>
              )}
            </div>
            <div title="Bed temperature">
              🛏️ {status.temperatures.bed.current.toFixed(0)}°
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
