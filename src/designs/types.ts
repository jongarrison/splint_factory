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

export interface DesignRegistryEntry extends DesignDefinition {
  slug: DesignSlug;
  hasPreviewImage: boolean;
  hasMeasurementImage: boolean;
  hasCustomForm: boolean;
}
