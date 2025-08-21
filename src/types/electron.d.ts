// Type definitions for Electron API based on preload.js

interface PrinterConfig {
  model: string;                    // Printer model (P1S, P1P, X1C, A1, etc.)
  host: string;                     // IP address of the printer
  accessCode: string;               // Access code from printer settings
  serial: string;                   // Unique serial number
}

interface PrinterStatus {
  success: boolean;
  status?: string;
  progress?: number;
  currentJob?: string;
  error?: string;
  needsConfiguration?: boolean;
  [key: string]: unknown; // Allow additional properties
}

interface SystemInfo {
  platform: string;
  arch: string;
  hostname: string;
  cpus: number;
  totalmem: number;
  freemem: number;
  uptime: number;
  userAgent?: string;
  language?: string;
  timezone?: string;
}

interface CommandResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
}

interface ElectronAPI {
  // System command execution
  executeCommand: (command: string, args?: string[]) => Promise<CommandResult>;
  
  // System information
  getSystemInfo: () => Promise<SystemInfo>;
  getEnvironmentInfo: () => Promise<SystemInfo>;
  
  // Bambu printer operations
  getPrinterStatusInfo: (printerConfig?: PrinterConfig) => Promise<PrinterStatus>;
  
  // Printer configuration management
  loadPrinterConfig: () => Promise<{ success: boolean; config?: PrinterConfig; error?: string; path?: string }>;
  savePrinterConfig: (config: PrinterConfig) => Promise<{ success: boolean; error?: string; path?: string }>;
  
  // File operations
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  
  // Network requests
  makeRequest: (url: string, options?: any) => Promise<any>;
  
  // Common command shortcuts
  commands: {
    listFiles: (directory?: string) => Promise<CommandResult>;
    getCurrentDirectory: () => Promise<CommandResult>;
    getUsername: () => Promise<CommandResult>;
    getDate: () => Promise<CommandResult>;
    getSystemUptime: () => Promise<CommandResult>;
    getDiskUsage: () => Promise<CommandResult>;
    getProcesses: () => Promise<CommandResult>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
