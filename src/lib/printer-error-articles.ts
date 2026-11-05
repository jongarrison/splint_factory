export interface PrinterErrorArticle {
  slug: string;
  title: string;
  summary: string;
  steps: string[];
  inspect: string[];
  supportNote: string;
  video?: {
    label: string;
    url: string;
  };
}

const ARTICLES: Record<string, PrinterErrorArticle> = {
  'power-cycle': {
    slug: 'power-cycle',
    title: 'Safely Restart the Printer',
    summary: 'Use this procedure after Splint Queue has stopped and verified an interrupted print.',
    steps: [
      'Remove the stopped print and clean all loose material from the build plate.',
      'Confirm the build plate is flat, clean, and seated against its rear alignment points.',
      'Switch the printer off with the physical power switch.',
      'Wait until the display is dark and all fans have stopped.',
      'Switch the printer on and wait for its normal idle screen.',
      'Return to Splint Queue and wait for the recovery confirmation before printing again.',
    ],
    inspect: [
      'No filament or printed material remains around the nozzle.',
      'The build plate is not raised, overlapping an alignment point, or sitting on debris.',
      'The printer display is idle and does not show another error.',
    ],
    supportNote: 'If Splint Queue remains blocked after the restart, record the displayed code and contact support.',
  },
  unknown: {
    slug: 'unknown',
    title: 'Recover from an Unrecognized Printer Error',
    summary: 'Splint Queue retained the raw printer code even though specific guidance is not yet available.',
    steps: [
      'Do not start another print.',
      'Remove the stopped print and clean all loose material from the build plate.',
      'Confirm the build plate is properly positioned and flat.',
      'Check the nozzle area for stuck filament only after the nozzle is cool.',
      'Follow the safe printer restart procedure below.',
    ],
    inspect: [
      'Photograph any code shown on the printer or Splint Queue.',
      'Check the plate, heatbed, and nozzle area for visible debris.',
      'Do not disassemble the printer or touch a hot nozzle.',
    ],
    supportNote: 'If the same code returns after restart, contact support with the Object ID and raw error code.',
  },
  'heatbed-homing': {
    slug: 'heatbed-homing',
    title: 'Heatbed Homing Recovery',
    summary: 'The printer could not reliably detect nozzle contact while checking the build surface.',
    steps: [
      'Wait for the nozzle to cool before touching material near it.',
      'Remove the stopped print and clean the build plate.',
      'Remove any filament stuck to the nozzle tip.',
      'Reseat the build plate flat against both rear alignment points.',
      'Check that no debris is trapped between the plate and heatbed.',
      'Power cycle the printer and wait for Splint Queue to verify a safe idle state.',
    ],
    inspect: [
      'The build plate is flat and not overlapping an alignment point.',
      'The nozzle tip and hotend are visibly secure.',
      'No plastic or debris is trapped on the plate or heatbed.',
    ],
    supportNote: 'If homing fails again, stop using the printer and contact support with the Object ID and HMS code.',
    video: {
      label: 'Watch: clean, position, and check the build plate',
      url: 'https://youtube.com/shorts/daw2SJ43M5w?si=3xadIytELgRyh56i',
    },
  },
  'build-plate-placement': {
    slug: 'build-plate-placement',
    title: 'Build Plate Placement Recovery',
    summary: 'The printer detected that the build plate may be missing, raised, or incorrectly seated.',
    steps: [
      'Remove the stopped print and any loose material.',
      'Lift off the build plate and clean the underside and heatbed.',
      'Reinstall the plate flat against both rear alignment points.',
      'Confirm no plate edge is raised or overlapping an alignment point.',
      'Power cycle the printer and wait for Splint Queue to verify a safe idle state.',
    ],
    inspect: [
      'The entire plate lies flat against the magnetic heatbed.',
      'No debris is trapped under the plate.',
      'The plate is not shifted beyond the heatbed edges.',
    ],
    supportNote: 'If the placement error returns with a correctly seated plate, contact support.',
    video: {
      label: 'Watch: clean, position, and check the build plate',
      url: 'https://youtube.com/shorts/daw2SJ43M5w?si=3xadIytELgRyh56i',
    },
  },
  'developer-mode': {
    slug: 'developer-mode',
    title: 'Restore Printer Network Access',
    summary: 'A firmware or settings change may have disabled the local printer controls Splint Queue requires.',
    steps: [
      'Open WLAN settings on the printer display.',
      'Confirm LAN Only Mode is enabled.',
      'Confirm Developer Mode is enabled.',
      'Save the settings and return to Splint Queue.',
      'Wait for the printer status to reconnect before printing.',
    ],
    inspect: [
      'The printer is connected to the expected local network.',
      'The LAN access code matches the value saved in Splint Queue settings.',
    ],
    supportNote: 'If local access remains unavailable, contact support before changing additional network settings.',
  },
};

export function getPrinterErrorArticle(slug: string): PrinterErrorArticle | null {
  return ARTICLES[slug] || null;
}

/**
 * Provide the complete recovery library to navigation surfaces without duplicating article metadata.
 */
export function getPrinterErrorArticles(): readonly PrinterErrorArticle[] {
  return Object.values(ARTICLES);
}
