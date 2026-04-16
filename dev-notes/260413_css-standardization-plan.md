# CSS Standardization Plan — splint_factory

_Working reference for ongoing CSS refactoring and new UI development._
_Migration progress: [css-migration-tracker.md](css-migration-tracker.md)_

---

## The Core Goals

1. **Preserve the existing dark-mode appearance** while replacing the presentational CSS names and legacy light/dark toggle machinery that produce it. The visual result is correct; the code describing it is misleading.
2. **Name things by function, not appearance.** CSS classes, tokens, and element attributes should describe what a thing *is* or *does* — not what color or style it currently happens to have.
3. **Lay groundwork for automated end-to-end testing** by adding stable `data-testid` attributes to meaningful UI elements as pages are migrated. Test selectors must not depend on CSS class names.
4. **Roll out incrementally, one page at a time.** Unmigrated pages continue to work via the legacy override shim in `globals.css`. No big-bang rewrite; migrate a page when it is touched for other work.

## The Core Problem: Presentational vs Semantic Naming

The correct term is **semantic CSS naming** — naming classes and tokens based on *function or purpose* rather than *visual appearance*. The anti-pattern is **presentational naming**, and we have a lot of it.

Example of the problem:
```jsx
// Presentational (bad): reads as "white background", renders dark
<div className="bg-white text-gray-900">

// Semantic (good): "this is a surface element with primary text"
<div className="bg-surface text-primary">
```

The current codebase has three layers of this problem:
1. **Tailwind light-mode classes everywhere** (`bg-white`, `bg-gray-50`, `text-gray-900`) mapped to dark values via `!important` overrides in globals.css — the class name lies about what it renders.
2. **Dead dark/light mode machinery** — `:root.light` toggle variants, `dark:` Tailwind variants, and `isDarkMode` JS prop switching that no longer reflects how the app actually works (permanent dark mode).
3. **Semantic utility classes defined but not used** — `.bg-surface`, `.text-primary`, etc. exist in globals.css but most JSX ignores them.

---

## Design Decisions (Settled)

- **Permanent dark mode.** The `:root.light` toggle and all light-mode support machinery will eventually be removed. The app is dark-mode-only.
- **CSS variables are the token system.** The existing `:root` variable block is the right approach — it just needs consistent use.  
- **Tailwind for layout/spacing/typography only.** Tailwind utility classes for color, background, and border should be replaced with semantic classes backed by CSS variables.
- **No `!important` override shim long-term.** The current shim in globals.css (mapping `.bg-white` to `--surface` etc.) exists to bridge old presentational code to the token system. As pages are migrated it will shrink and eventually disappear.

---

## Target Token System

The CSS variables already defined in `:root` are correct. Additions needed:

### Missing: Status colors
```css
:root {
  /* Status semantic tokens — for badges, state indicators */
  --status-success-bg: #065f46;     /* dark green bg */
  --status-success-text: #6ee7b7;   /* light green text */
  --status-error-bg: #7f1d1d;       /* dark red bg */
  --status-error-text: #fca5a5;     /* light red text */
  --status-warning-bg: #78350f;     /* dark amber bg */
  --status-warning-text: #fcd34d;   /* light amber text */
  --status-pending-bg: #1e3a5f;     /* dark blue bg */
  --status-pending-text: #93c5fd;   /* light blue text */
  --status-neutral-bg: #1f2937;     /* surface-level bg (gray) */
  --status-neutral-text: #9ca3af;   /* muted text */
}
```

Status colors are the most visually broken thing now (the `-100`/`-800` badge pairs are not covered by the override shim).

### Missing: Interactive element tokens
```css
:root {
  --btn-primary-bg: var(--accent-blue);
  --btn-primary-text: #000000;
  --btn-primary-hover-bg: var(--accent-blue-hover);
  --btn-danger-bg: var(--accent-red);
  --btn-danger-text: #000000;
  --input-bg: #ffffff;
  --input-text: #111827;
  --input-border: #d1d5db;
  --input-focus-ring: var(--accent-blue);
}
```

---

## Semantic CSS Utility Classes

These are the classes to use in JSX. They live in globals.css and read as purpose/function.

### Already defined (use these):
| Class | Purpose |
|---|---|
| `.text-primary` | Headings, prominent labels |
| `.text-secondary` | Body text |
| `.text-tertiary` | Supporting labels |
| `.text-muted` | Disabled, placeholder-like |
| `.bg-surface` | Card/panel backgrounds (lighter dark) |
| `.bg-surface-secondary` | Page background (deepest dark) |
| `.border-default` | Standard borders |

### To add (status badges):
| Class | Purpose |
|---|---|
| `.status-success` | Completed, healthy, active |
| `.status-error` | Failed, offline, critical |
| `.status-warning` | Degraded, processing, caution |
| `.status-pending` | Queued, waiting, in-progress |
| `.status-neutral` | Unknown, inactive, default |

Usage:
```jsx
<span className="status-badge status-success">Completed</span>
<span className="status-badge status-error">Failed</span>
```

Where `.status-badge` handles shape/padding and `.status-{state}` provides the colors.

### Already defined (keep):
- `.form-input-base` — form inputs (hardcoded light bg is intentional for legibility)
- `.display-field` — monospace data/code blocks

---

## Tailwind Usage Rules (Going Forward)

**Use Tailwind for:**
- Layout: `flex`, `grid`, `min-h-screen`, `w-full`, `gap-4`, etc.
- Spacing: `p-4`, `mx-auto`, `mt-2`, etc.
- Borders radius/width: `rounded-lg`, `border`, `border-2`
- Shadows: `shadow-sm`, `shadow-md`
- Transitions/animation utilities

**Do NOT use Tailwind for (replace with semantic classes):**
- Colors: ~~`text-gray-900`~~ → `.text-primary`
- Backgrounds: ~~`bg-white`~~, ~~`bg-gray-50`~~ → `.bg-surface`, `.bg-surface-secondary`
- Border colors: ~~`border-gray-200`~~ → `.border-default`
- Status colors: ~~`bg-green-100 text-green-800`~~ → `.status-success`
- `dark:` variants — not used in this app, remove on sight
- `isDarkMode` JS branching — replace with CSS variables
- Typography size/weight **when it is part of a named component** — `.page-title` owns its font-size and font-weight; don't add `text-3xl font-bold` alongside it. For one-off text sizing with no semantic component class, Tailwind typography utilities are fine.

**Avoid `group`/`group-hover:` for color changes.** Tailwind's `group-hover:text-blue-600` generates a class name (`.group-hover\:text-blue-600`) that the globals.css shim does not remap — it renders as raw Tailwind blue. For hover-triggered color changes that cross a parent-child boundary, use a CSS component class with a plain parent-child rule instead:
```css
/* In semantic.css */
.design-card:hover .design-card-title { color: var(--accent-blue); }
```
Tailwind `group`/`group-hover:` is still fine for non-color properties (e.g., `group-hover:shadow-lg`).

---

## Functional IDs, Names, and Test Attributes

### The Purpose

Every meaningful UI element should have a stable functional identifier that serves both:
1. CSS hooks (independent of class name changes)
2. End-to-end test targets (Playwright/Puppeteer selectors)

The selector strategy for E2E tests should be `[data-testid="..."]`, not CSS class names (which change during styling work).

### Naming Convention

Format: `{page/component}-{element}-{qualifier?}`

All lowercase, hyphen-separated. Names describe *what it does* not *what it looks like*.

```jsx
// Page-level containers
<main data-testid="orders-page">
<div data-testid="orders-filter-panel">
<table data-testid="orders-table">

// Rows and repeated elements use index or ID
<tr data-testid="order-row" data-order-id={order.id}>

// Actions
<button data-testid="order-submit-btn">Submit</button>
<button data-testid="order-cancel-btn">Cancel</button>
<button data-testid="order-detail-link">View Details</button>

// Forms
<form data-testid="design-job-form">
<input data-testid="patient-id-input" ...>
<select data-testid="printer-select" ...>

// Status indicators
<span data-testid="printer-status-badge">Online</span>
<div data-testid="job-progress-bar">
```

### Scoping

Pages own their `data-testid` namespace. Shared components (Header, StatusBanner) use their component name as prefix:
- `header-nav-link`, `header-nav-logo`
- `printer-status-banner`, `printer-status-label`

### IDs for CSS

Reserve HTML `id` attributes for single-occurrence structural landmarks (skip sections, main content areas for accessibility). Don't use `id` for CSS styling hooks — that's what classes are for.

---

## CSS File Strategy During Migration

Two CSS files live side by side in `src/app/`:

| File | Purpose | Fate |
|---|---|---|
| `globals.css` | Legacy styles + override shim (`bg-white` → `--surface` etc.) | Shrinks as pages migrate; eventually gutted |
| `semantic.css` | New semantic classes + status tokens | Grows into the single stylesheet |

Both are imported in `layout.tsx`. Unmigrated pages rely on the `globals.css` shim and keep working untouched. Migrated pages use `semantic.css` classes exclusively. No page needs to change until you're ready to touch it.

---

## Migration Process (One Page at a Time)

Each page migration follows the same checklist. This can be done incrementally — new work should follow the new standard, existing pages migrate when touched.

### Per-Page Checklist

- [ ] **Remove dead dark/light machinery** — delete `dark:` variants, `isDarkMode` JS branching
- [ ] **Replace presentational background classes** — `bg-white`/`bg-gray-50` → `.bg-surface`/`.bg-surface-secondary`
- [ ] **Replace presentational text classes** — `text-gray-900`/`text-gray-600` → `.text-primary`/`.text-secondary`/`.text-muted`
- [ ] **Replace status badge colors** — `-100`/`-800` badge classes → `.status-badge .status-{state}`
- [ ] **Replace border color classes** — `border-gray-200`/`border-gray-300` → `.border-default`
- [ ] **Add `data-testid` attributes** to page container, filters, table/list, rows, action buttons, form inputs
- [ ] **Verify visually** — page renders correctly in dark mode, status badges have proper contrast
- [ ] **Shrink the override shim** — if a page is fully migrated and no longer needs `bg-white`→`--surface` mapping, note it. Once all pages are migrated, the shim block in globals.css can be removed.

### What "Touching a Page" Means

When doing any functional change on a page, spend an extra 10-15 minutes doing the CSS migration for that page at the same time. This is "clean as you go" — no need for a dedicated CSS sprint.

---

## Priority / Known Issues

These are the currently broken visual items that should be fixed proactively (not wait for the page to be touched):

1. **Status badges everywhere** — the `-100`/`-800` Tailwind badge pattern is visually broken (light pills on dark bg). This should be fixed across all pages in one pass since it's a defined set of patterns.  
2. **Header.tsx `isDarkMode` branching** — the Header renders in "browser mode" with light colors, bypassing the theme. Fix when Header is next touched.
3. **`PrinterStatusBanner.tsx` and `ReloadButton.tsx`** — remove dead `dark:` variants, replace with semantic classes.

---

## Files to Eventually Clean Up

- `globals.css` — remove `:root.light` block and all `!important` override shims once page migration is complete
- `Header.tsx` — remove `isDarkMode` prop and all variant branching
- Any component with `dark:` Tailwind variants (they do nothing — `dark:` fires on system `prefers-color-scheme`, not on `:root.light`)
