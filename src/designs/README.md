# Design Definitions

Each splint design lives in its own subdirectory here. Three things define a design:
1. `definition.json` — static schema (required)
2. `hints.ts` — cross-field hints shown in the new-job form (optional)
3. `clinical-guide.md` — Clinical Guide & User Instructions page content (optional)

---

## Directory layout

```
src/designs/
  registry.ts              # server-side registry (imports all definitions)
  hints-registry.ts        # client-safe registry (maps design IDs to hint functions)
  types.ts                 # shared TypeScript types
  <design-slug>/
    definition.json        # required
    hints.ts               # optional, add if the design needs cross-field guidance
    clinical-guide.md      # optional, exposes /designs/<slug>/clinical-guide
```

---

## definition.json

Fields:
- `id` — stable cuid (generate once, never change)
- `name` — user-facing label, must be unique
- `algorithmName` — maps to `{algorithmName}.gh` in `splint_geo_processor/generators/`
- `isActive` — controls visibility on the design menu
- `category` — `"splint"` (default, omit) or `"tool"` (see below)
- `generatorVersion` — string, only meaningful for `"tool"` designs (see below)
- `inputParameters` — array of parameter definitions (see below)

### Input parameter types

| `InputType` | Extra fields | Notes |
|---|---|---|
| `Float` | `NumberMin`, `NumberMax` | Decimal input |
| `Integer` | `NumberMin`, `NumberMax` | Whole numbers only |
| `Text` | `TextMinLen`, `TextMaxLen` (required) | Free text |
| `Boolean` | none | Renders as a checkbox; defaults to `false`; use `include_` prefix by convention |

---

## Adding a new design

1. Create `src/designs/<slug>/definition.json` (copy an existing one as a template)
2. Register it in `registry.ts` (two lines: import + entry in `designEntries`)
3. If the design needs cross-field hints, add `hints.ts` and register it in `hints-registry.ts`
4. If a Clinical Guide & User Instructions page is available, add `clinical-guide.md` (no registration needed — presence is detected automatically)
5. Add a `{algorithmName}.json` dev data file in `splint_geo_processor/generators/<algo>/` for local Grasshopper testing

---

## Tool designs (category: "tool")

Some designs are really fitting tools (e.g. Sizing Rings) rather than per-patient splints:
they have no `inputParameters`, and their geometry never varies. Setting `"category": "tool"`
changes how a design behaves:

- On `/design-menu`, it's grouped into a separate "Tools" section instead of the main grid
  (hidden entirely if an org has no visible tools — visibility still comes from the existing
  `OrganizationDesign` table, same as splint designs).
- Clicking it skips the new-job input form entirely and calls
  `POST /api/designs/[id]/quick-run`, which:
  1. Reuses this org's own completed job for the design, if one already exists, or
  2. Clones the file references (blob URLs, not the underlying files — nothing is
     re-uploaded or reprocessed) from *any* other org's completed job at the same
     `generatorVersion`, or
  3. Falls back to a normal geo-processor run only if nobody has produced this
     `generatorVersion` yet anywhere.

Bump `generatorVersion` (a plain string, e.g. `"2"`) whenever you edit the design's
`.gh`/`.py` generator file. That invalidates every org's cached/cloned job at once, so the
very next click (from any org) transparently reprocesses instead of reusing stale geometry.

---

## Clinical Guide (clinical-guide.md)

Optional Markdown file rendered at `/designs/<slug>/clinical-guide`. Uses GitHub Flavored Markdown (tables, task lists, strikethrough). When present, an info icon appears on the design's card in `/design-menu` and a "Clinical Guide & User Instructions" link appears in the header of the Measurement Guide card on `/design-jobs/new`. No registry entry is required — the file's existence is checked in `registry.ts` at load time and exposed as `hasClinicalGuide` on the API.

---

## Hints (hints.ts)

Hints are pure TypeScript functions evaluated in the browser on field blur. They take the current form values and return zero or more `DesignHint` objects. Each hint targets a specific `InputName` — the message appears inline below that field.

```typescript
import type { DesignHint } from '../types';

export function getHints(values: Record<string, number | boolean | string>): DesignHint[] {
  const hints: DesignHint[] = [];
  // Add conditions here...
  return hints;
}
```

Register the function in `hints-registry.ts` under the design's ID.
