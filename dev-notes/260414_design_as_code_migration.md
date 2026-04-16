# Design-as-Code Migration Plan

Clean break. All 6 designs (including inactive Infinity Splint 251004) migrate to code.

## Decisions
- `definition.json` per design with `$schema` reference for VS Code typeahead
- `inputParameters` stored as native JSON array (not stringified)
- Images as static files in `public/designs/{slug}/` (placeholder PNGs where export is difficult)
- OrganizationDesign stays DB-only (per-environment config)
- No admin schema editor -- edit JSON files directly with schema validation
- geo_processor manifest.json validation is a nice-to-have, low priority

## File Structure
```
src/designs/
  design-definition.schema.json   # JSON Schema for VS Code typeahead
  types.ts                        # TS types: DesignDefinition, InputParameter
  registry.ts                     # loads all definitions, exports typed map
  cylinder/
    definition.json
  stax-splint/
    definition.json
    form.tsx                      # optional: custom form component
  infinity-extend/
    definition.json
  infinity-extend-contracture/
    definition.json
  infinity-flex/
    definition.json
  infinity-splint-251004/
    definition.json

public/designs/
  cylinder/
    preview.png                   # placeholder or exported from DB
    measurement.png
  stax-splint/
    preview.png
    measurement.png
  ...
```

## DB Changes
**Design table (post-migration) keeps only FK-target columns:**
id, name, algorithmName, shortDescription, isActive, createdAt, updatedAt

**Removed columns:** inputParameterSchema, previewImage, previewImageContentType, previewImageUpdatedAt, measurementImage, measurementImageContentType, measurementImageUpdatedAt, creatorId

**Removed relation:** Design.creator -> User (creatorId FK)

Sync function upserts DB rows from code registry on deploy/seed.

## Phase 1: Create design file structure (non-breaking)
- [ ] 1. `src/designs/design-definition.schema.json`
- [ ] 2. `src/designs/types.ts`
- [ ] 3. `definition.json` for all 6 designs
- [ ] 4. `src/designs/registry.ts`
- [ ] 5. `.vscode/settings.json` json.schemas entry
- [ ] 6. Placeholder images in `public/designs/` (replace manually later)

## Phase 2: Switch reads to registry, add DB sync
- [ ] 7. Sync function in `prisma/seed.ts` (upsert Design rows from registry)
- [ ] 8. `/api/designs` reads from registry (schema + images from code, visibility still from DB)
- [ ] 9. `/api/admin/design-definitions` GET reads from registry
- [ ] 10. `design-jobs/new` loads schema from registry
- [ ] 11. Image URLs point to `/designs/{slug}/preview.png` static paths
- [ ] 12. Run sync on local dev DB, verify everything works end-to-end

## Phase 3: Remove old code and DB columns
- [ ] 13. Prisma migration: drop removed columns from Design
- [ ] 14. Delete `/admin/design-definitions/[id]` (create/edit page)
- [ ] 15. Delete `/admin/design-definitions/new` route (if separate)
- [ ] 16. Delete POST/PUT/PATCH API routes for design-definitions
- [ ] 17. Delete `/api/design-images/` route
- [ ] 18. Clean up orphaned types, components, utils
- [ ] 19. Update `/admin/design-definitions` list page to read-only (from registry)

## Phase 4: Custom forms (follow-on)
- [ ] 20. Wire registry to dynamically load `form.tsx` if present
- [ ] 21. Build first custom form (e.g., STAX Splint)

## Phase 5: Cross-repo validation (low priority)
- [ ] 22. `splint_geo_processor/generators/manifest.json`
- [ ] 23. Dev validation script in splint_factory checking algorithmName against manifest

## Reference: Production Design Data
```
cmn8hrxu00003k104zwhusykv  Cylinder                       cylinder                            Active
cmlru1okn0001i9041mcv44nf  Infinity Extend                InfinityExtend                      Active
cmlslk6ji0001jr04m39zgbg0  Infinity Extend Contracture    InfinityExtend                      Active
cmlljl3ha0001ju04s6szruyx  Infinity Flex                  InfinityFlex                        Active
b2858cf0-...-400e67c6789f  Infinity Splint 251004         infinity_splint_generator_251004     Inactive
2fb69825-...-488f15eb2a56  STAX Splint                    stax_splint_v1                       Active
```

## Reference: Algorithm <-> .gh files
```
cylinder              -> cylinder.gh
InfinityExtend        -> InfinityExtend.gh    (2 designs share this)
InfinityFlex          -> InfinityFlex.gh
stax_splint_v1        -> stax_splint_v1.gh
infinity_splint_generator_251004 -> infinity_splint_generator_251004.gh
```
Unreferenced .gh files: BuddyRings.gh, finger_model.gh
