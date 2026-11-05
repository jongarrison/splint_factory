export type PrinterAlertKind =
  | 'hms'
  | 'print_error'
  | 'print_failed'
  | 'filename_mismatch'
  | 'ambiguous_stop';

export interface PrinterAlert {
  id: string;
  kind: PrinterAlertKind;
  blocking: boolean;
  raw: Record<string, unknown>;
  printJobId: string | null;
  firstSeenAt: number;
  lastSeenAt: number;
  count: number;
  temps?: {
    nozzle?: { actual?: number | null; target?: number | null };
    bed?: { actual?: number | null; target?: number | null };
  };
}

export interface PrinterErrorCatalogEntry {
  id: string;
  hmsCodes?: string[];
  title: string;
  explanation: string;
  immediateSteps: string[];
  articlePath: string;
  videoUrl?: string;
}

const CATALOG: PrinterErrorCatalogEntry[] = [
  {
    id: 'heatbed-homing',
    hmsCodes: ['0300-0D00-0002-0001'],
    title: 'Heatbed Homing Problem',
    explanation: 'The printer could not reliably measure nozzle contact while homing the bed.',
    immediateSteps: [
      'Do not start another print.',
      'Reseat the build plate flat against its alignment points.',
      'Check the plate, heatbed, and nozzle tip for debris.',
      'Let the nozzle cool before removing stuck filament.',
    ],
    articlePath: '/support/printer-errors/heatbed-homing',
  },
  {
    id: 'build-plate-placement',
    hmsCodes: ['0300-0D00-0002-0005'],
    title: 'Build Plate Placement Problem',
    explanation: 'The printer detected that the build plate may be missing, raised, or incorrectly seated.',
    immediateSteps: [
      'Do not start another print.',
      'Remove and reinstall the build plate.',
      'Confirm the plate lies flat and does not overlap an alignment point.',
      'Remove debris between the plate and heatbed.',
    ],
    articlePath: '/support/printer-errors/build-plate-placement',
  },
  {
    id: 'developer-mode',
    hmsCodes: ['0700-7000-0000-0007'],
    title: 'Printer Network Settings Required',
    explanation: 'A firmware or settings change may have disabled LAN Only Mode or Developer Mode.',
    immediateSteps: [
      'Open WLAN settings on the printer display.',
      'Confirm LAN Only Mode is enabled.',
      'Confirm Developer Mode is enabled.',
      'Return here after the printer reconnects.',
    ],
    articlePath: '/support/printer-errors/developer-mode',
  },
];

const GENERIC_HMS: PrinterErrorCatalogEntry = {
  id: 'unknown-hms',
  title: 'Printer Error Needs Attention',
  explanation: 'Splint Queue does not yet recognize this printer condition. The raw code has been retained for support.',
  immediateSteps: [
    'Do not start another print.',
    'Remove the stopped print and clean all loose material from the build plate.',
    'Confirm the build plate is properly positioned and flat.',
    'Power-cycle the printer before attempting a replacement print.',
  ],
  articlePath: '/support/printer-errors/unknown',
};

const GENERIC_PRINT_ERROR: PrinterErrorCatalogEntry = {
  id: 'unknown-print-error',
  title: 'Print Interrupted by Printer Error',
  explanation: 'The printer reported a nonzero internal error value without recognized recovery guidance.',
  immediateSteps: GENERIC_HMS.immediateSteps,
  articlePath: '/support/printer-errors/unknown',
};

const PRINT_FAILED: PrinterErrorCatalogEntry = {
  id: 'print-failed',
  title: 'Printer Confirmed Print Failure',
  explanation: 'The printer reported that the active print ended in a failed state.',
  immediateSteps: GENERIC_HMS.immediateSteps,
  articlePath: '/support/printer-errors/power-cycle',
};

const FILENAME_MISMATCH: PrinterErrorCatalogEntry = {
  id: 'filename-mismatch',
  title: 'Unexpected Print File Detected',
  explanation: 'The file active on the printer does not identify the print attempt owned by this Splintbot.',
  immediateSteps: [
    'Do not start another print.',
    'Check the printer display for the file currently running.',
    'Contact support before deleting files or retrying the queue entry.',
  ],
  articlePath: '/support/printer-errors/unknown',
};

const AMBIGUOUS_STOP: PrinterErrorCatalogEntry = {
  id: 'ambiguous-stop',
  title: 'Print Stopped Unexpectedly',
  explanation: 'The printer changed directly from running to idle. Splint Queue retained the final state but has not classified the print as failed.',
  immediateSteps: [
    'Do not start another print.',
    'Inspect the printer and the partial print.',
    'Follow the standard power-cycle procedure.',
  ],
  articlePath: '/support/printer-errors/power-cycle',
};

/**
 * Resolve raw Electron facts to Factory-owned wording without making safety decisions.
 */
export function resolvePrinterError(alert: PrinterAlert): PrinterErrorCatalogEntry {
  if (alert.kind === 'filename_mismatch') return FILENAME_MISMATCH;
  if (alert.kind === 'ambiguous_stop') return AMBIGUOUS_STOP;
  if (alert.kind === 'print_failed') return PRINT_FAILED;
  if (alert.kind === 'print_error') return GENERIC_PRINT_ERROR;

  const catalogId = typeof alert.raw.catalogId === 'string' ? alert.raw.catalogId : null;
  if (catalogId) {
    const catalogMatch = CATALOG.find((entry) => entry.id === catalogId);
    if (catalogMatch) return catalogMatch;
  }

  const code = typeof alert.raw.code === 'string' ? alert.raw.code : null;
  return CATALOG.find((entry) => code && entry.hmsCodes?.includes(code)) || GENERIC_HMS;
}

export function getPrinterErrorCatalog(): readonly PrinterErrorCatalogEntry[] {
  return CATALOG;
}
