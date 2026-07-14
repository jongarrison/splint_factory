import type { InputParameter } from '@/types/design-input-parameter';

export interface DesignDefinition {
  id: string;
  name: string;
  algorithmName: string;
  shortDescription: string | null;
  isActive: boolean;
  inputParameters: InputParameter[];
}

// Slug is the directory name under src/designs/, used for image paths and routing
export type DesignSlug = string;

// A contextual hint shown in the new-job form when cross-field conditions are met
export interface DesignHint {
  message: string;
  targetParameter: string; // InputName of the parameter row to display the hint under
  severity: 'warning' | 'info';
}

// Function signature for per-design hint evaluation (client-safe, pure logic)
export type HintsFn = (values: Record<string, number | boolean | string>) => DesignHint[];

// Props for a design's bespoke input form. Used when a design's parameters do not fit
// the flat scalar schema (e.g. RelativeMotion's nested per-finger data). The form owns its
// own fields/validation and writes the full job payload up via onChange.
export interface CustomFormProps {
  value: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  onValidChange?: (valid: boolean) => void;
}

export interface DesignRegistryEntry extends DesignDefinition {
  slug: DesignSlug;
  hasPreviewImage: boolean;
  hasMeasurementImage: boolean;
  hasCustomForm: boolean;
  // True when a clinical-guide.md file lives alongside definition.json.
  // Controls the "Clinical Guide & User Instructions" link in the UI.
  hasClinicalGuide: boolean;
}
