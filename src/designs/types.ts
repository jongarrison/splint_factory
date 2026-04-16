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

export interface DesignRegistryEntry extends DesignDefinition {
  slug: DesignSlug;
  hasPreviewImage: boolean;
  hasMeasurementImage: boolean;
  hasCustomForm: boolean;
}
