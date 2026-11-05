// Type definitions for Electron API based on preload.js
import type { PrinterAlert } from '@/lib/printer-error-catalog';

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

interface EnvironmentInfo extends SystemInfo {
  environment: string;
  environmentName: string;
  factoryUrl: string;
  deviceId: string;
}

interface CommandResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
}

interface PrinterAvailability {
  busy: boolean;
  reason: string | null;
  attempt: {
    printJobId: string;
    phase: string;
    filename: string | null;
  } | null;
}

interface PrinterRecoveryStatus {
  phase:
    | 'idle'
    | 'grace_period'
    | 'stopping'
    | 'verifying_stop'
    | 'awaiting_power_cycle'
    | 'urgent_power_off'
    | 'power_cycle_disconnected'
    | 'recovered_safe';
  printJobId?: string | null;
  conditionId?: string;
  source?: 'operator' | 'automatic';
  deadline?: number;
  verificationDeadline?: number;
  reason?: string;
  state?: string | null;
  filename?: string | null;
  temperatures?: {
    nozzle: { actual: number | null; target: number | null };
    bed: { actual: number | null; target: number | null };
  };
  auditEvents?: Array<{
    eventKey: string;
    eventType: string;
    printJobId: string;
    evidence: Record<string, unknown>;
  }>;
  updatedAt?: number;
}

interface ElectronAPI {
  // System command execution
  executeCommand: (command: string, args?: string[]) => Promise<CommandResult>;
  
  // System information
  getSystemInfo: () => Promise<SystemInfo>;
  getEnvironmentInfo: () => Promise<EnvironmentInfo>;
  
  // Bambu printer operations
  getPrinterStatusInfo: (printerConfig?: PrinterConfig) => Promise<PrinterStatus>;
  printer: {
    getAvailability: () => Promise<PrinterAvailability>;
    getActiveAlerts: () => Promise<PrinterAlert[]>;
    getRecoveryStatus: () => Promise<PrinterRecoveryStatus>;
    acknowledgeRecovery: () => Promise<{ acknowledged: boolean }>;
    beginPowerCycleRecovery: (printJobId: string) => Promise<{
      started: boolean;
      reason?: 'print_attempt_not_found' | 'printer_not_terminal';
      status?: PrinterRecoveryStatus;
    }>;
    acknowledgeRecoveryAudit: (eventKey: string) => Promise<{ acknowledged: boolean }>;
    acknowledgeAlert: (alertId: string) => Promise<{
      acknowledged: boolean;
      reason?: 'not_found' | 'blocking' | 'invalid_id';
    }>;
    onAlert: (callback: (event: {
      type: string;
      payload?: {
        action?: 'opened' | 'updated' | 'cleared';
        alert?: PrinterAlert;
      };
    }) => void) => () => void;
    subscribeToAvailability: (callback: (availability: PrinterAvailability) => void) => () => void;
    subscribeToRecoveryStatus: (callback: (status: PrinterRecoveryStatus) => void) => () => void;
    subscribeToStatus: (callback: (status: PrinterStatus) => void) => () => void;
    subscribeToPrintStatus: (callback: (status: unknown) => void) => () => void;
  };
  printing: {
    getFailureEvidence: (printJobId: string) => Promise<Record<string, unknown> | null>;
    stopPrint: () => Promise<{ success: boolean; response?: unknown; error?: string }>;
  };
  
  // Printer configuration management
  loadPrinterConfig: () => Promise<{ success: boolean; config?: PrinterConfig; error?: string; path?: string }>;
  savePrinterConfig: (config: PrinterConfig) => Promise<{ success: boolean; error?: string; path?: string }>;
  
  // File operations
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  
  // Network requests
  makeRequest: (url: string, options?: unknown) => Promise<unknown>;
  
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
