import { existsSync } from 'fs';
import { join } from 'path';
import type { DesignDefinition, DesignRegistryEntry } from './types';

import cylinderDef from './cylinder/definition.json';
import infinityExtendDef from './infinity-extend/definition.json';
import infinityExtendContractureDef from './infinity-extend-contracture/definition.json';
import infinityFlexDef from './infinity-flex/definition.json';
import infinitySplint251004Def from './infinity-splint-251004/definition.json';
import staxSplintDef from './stax-splint/definition.json';
import buddyRingsDuoDef from './buddy-rings-duo/definition.json';
import sizingRingsDef from './sizing-rings/definition.json';

const publicDesignsDir = join(process.cwd(), 'public', 'designs');

// Each entry pairs a slug (directory name) with its definition.json
const designEntries: Array<{ slug: string; definition: DesignDefinition }> = [
  { slug: 'cylinder', definition: cylinderDef as DesignDefinition },
  { slug: 'infinity-extend', definition: infinityExtendDef as DesignDefinition },
  { slug: 'infinity-extend-contracture', definition: infinityExtendContractureDef as DesignDefinition },
  { slug: 'infinity-flex', definition: infinityFlexDef as DesignDefinition },
  { slug: 'infinity-splint-251004', definition: infinitySplint251004Def as DesignDefinition },
  { slug: 'stax-splint', definition: staxSplintDef as DesignDefinition },
  { slug: 'buddy-rings-duo', definition: buddyRingsDuoDef as DesignDefinition },
  { slug: 'sizing-rings', definition: sizingRingsDef as DesignDefinition },
];

// Build the registry map (by ID) at module load time
const registryById = new Map<string, DesignRegistryEntry>();
const registryBySlug = new Map<string, DesignRegistryEntry>();

for (const { slug, definition } of designEntries) {
  const entry: DesignRegistryEntry = {
    ...definition,
    slug,
    hasPreviewImage: existsSync(join(publicDesignsDir, slug, 'preview.png')),
    hasMeasurementImage: existsSync(join(publicDesignsDir, slug, 'measurement.png')),
    hasCustomForm: false,
  };
  registryById.set(definition.id, entry);
  registryBySlug.set(slug, entry);
}

export function getDesignById(id: string): DesignRegistryEntry | undefined {
  return registryById.get(id);
}

export function getDesignBySlug(slug: string): DesignRegistryEntry | undefined {
  return registryBySlug.get(slug);
}

export function getAllDesigns(): DesignRegistryEntry[] {
  return Array.from(registryById.values());
}

export function getActiveDesigns(): DesignRegistryEntry[] {
  return getAllDesigns().filter(d => d.isActive);
}
