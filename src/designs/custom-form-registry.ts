// Client-safe: no fs or server-only imports.
// Maps design IDs to their bespoke input-form components. Add an entry here when a design's
// parameters do not fit the flat scalar schema and it ships a CustomForm.tsx.
import type { ComponentType } from 'react';
import type { CustomFormProps } from './types';
import RelativeMotionForm from './relative-motion/CustomForm';

const customFormByDesignId: Record<string, ComponentType<CustomFormProps>> = {
  c3757c8d06e4bacc3bd245c8: RelativeMotionForm, // Relative Motion
};

export function getDesignCustomForm(designId: string): ComponentType<CustomFormProps> | undefined {
  return customFormByDesignId[designId];
}
