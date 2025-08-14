// Type definitions for Electron API
interface PrinterStatus {
  status?: string;
  progress?: number;
  currentJob?: string;
  [key: string]: unknown; // Allow additional properties
}

interface ElectronAPI {
  getPrinterStatusInfo: () => Promise<PrinterStatus | null>;
  executeCommand?: (command: string, args: string[]) => Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
