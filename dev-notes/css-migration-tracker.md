# CSS Migration Tracker

_Operational progress log for the CSS standardization effort._
_Reference guide: [css-standardization-plan.md](css-standardization-plan.md)_

---

## How to Use This File

**Starting a session:** Read the In Progress and the first few Not Started rows to understand where things stand. No other context needed.

**Completing a page:** Check off the per-page items, move the row to Done, and note the date. If something unexpected came up (a pattern not covered by the plan, a visual breakage that needed fixing), add a short note — this is how the plan improves over time.

**Adding new pages:** If a new page is created, add it to Not Started immediately. Migration happens when the page is first touched for real work.

---

## Status Key

| Symbol | Meaning |
|---|---|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Done |

Per-page checklist items (abbreviated from the plan):
- **A** — Remove dead dark/light machinery (`dark:` variants, `isDarkMode` JS)
- **B** — Replace presentational bg/text/border Tailwind classes with semantic classes
- **C** — Replace status badge color pairs with `.status-badge .status-{state}`
- **D** — Add `data-testid` attributes
- **V** — Visual verification pass

---

## Shared Components (migrate before or alongside pages that use them)

| Component | A | B | C | D | V | Notes |
|---|---|---|---|---|---|---|
| `components/navigation/Header.tsx` | [ ] | [ ] | — | [ ] | [ ] | Has `isDarkMode` JS branching; light-mode header in browser variant |
| `components/printer/PrinterStatusBanner.tsx` | [ ] | [ ] | [ ] | [ ] | [ ] | Has dead `dark:` variants |
| `components/ReloadButton.tsx` | [ ] | [ ] | — | [ ] | [ ] | Has dead `dark:` variants |
| `components/PrintAcceptanceModal.tsx` | [ ] | [ ] | — | [ ] | [ ] | |
| `components/PrintConfirmModal.tsx` | [ ] | [ ] | — | [ ] | [ ] | |
| `components/DeletePrintModal.tsx` | [ ] | [ ] | — | [ ] | [ ] | |
| `components/DeviceAuthOverlay.tsx` | [ ] | [ ] | — | [ ] | [ ] | |
| `components/landing/AboutContent.tsx` | [ ] | [ ] | — | [ ] | [ ] | Already uses `var(--...)` directly; may be mostly done |
| `components/landing/ElectronLanding.tsx` | [ ] | [ ] | — | [ ] | [ ] | |
| `components/ImagePlaceholder.tsx` | [ ] | [ ] | — | [ ] | [ ] | |
| `components/ProcessingLogViewer.tsx` | [ ] | [ ] | — | [ ] | [ ] | |
| `components/StlViewer.tsx` | [ ] | [ ] | — | [ ] | [ ] | |
| `components/VirtualKeyboard.tsx` | [ ] | [ ] | — | [ ] | [ ] | |

_Email templates (`src/emails/`) are intentionally excluded — they render in email clients and must stay self-contained with inline styles._

---

## Pages — Suggested Order

Higher priority = more traffic or currently visually broken. Migrate when touched.

| # | Page | A | B | C | D | V | Date | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | `app/design-menu/page.tsx` | [x] | [x] | — | [x] | [x] | 2026-04-09 | First migration. Revealed two plan amendments (see below) |
| 2 | `app/design-jobs/page.tsx` | [x] | [x] | [x] | [x] | [x] | 2026-04-09 | First status badge migration. Added btn-primary, btn-secondary, text-error, text-link-alt to semantic.css |
| 3 | `app/print-queue/page.tsx` | [x] | [x] | [x] | [x] | [ ] | 2026-04-10 | Most complex page. Added .action-delete to semantic.css. Dual Electron/browser paths. |
| 4 | `app/design-jobs/[id]/page.tsx` | [x] | [x] | [x] | [x] | [ ] | 2026-04-10 | Detail page. Added banner-*/btn-neutral/btn-warning/btn-alt/code-inline. Developer details section + debug modal. |
| 5 | `app/print-queue/[id]/page.tsx` | [x] | [x] | [x] | [x] | [ ] | 2026-04-10 | Detail page with Electron/browser paths. Added btn-success, btn-danger, progress-track/fill. |
| 6 | `app/design-jobs/new/page.tsx` | [x] | [x] | — | [x] | [ ] | 2026-04-10 | Form page. Added .input-field to semantic.css. |
| 7 | `app/admin/page.tsx` | [x] | [x] | [x] | [x] | [ ] | 2026-04-10 | System status dashboard. Colored stat tiles via CSS var inline refs. |
| 8 | `app/admin/users/page.tsx` | [x] | [x] | [x] | [x] | [x] | 2026-04-11 | |
| 9 | `app/admin/organizations/page.tsx` | [x] | [x] | [x] | [x] | [x] | 2026-04-14 | |
| 10 | `app/admin/organizations/[id]/page.tsx` | [x] | [x] | — | [x] | [x] | 2026-04-14 | |
| 11 | `app/admin/organizations/[id]/edit/page.tsx` | [x] | [x] | — | [x] | [x] | 2026-04-14 | Added .alert-success to semantic.css |
| 12 | `app/admin/design-definitions/page.tsx` | [x] | [x] | [x] | [x] | [x] | 2026-04-14 | Had old gradient + fragment shell structure, cleaned up |
| 13 | `app/admin/design-definitions/[id]/page.tsx` | [x] | [x] | — | [x] | [ ] | 2026-04-14 | Had old gradient + fragment shell; 3-card form with many param inputs |
| 14 | `app/admin/invitations/page.tsx` | [x] | [x] | [x] | [x] | [ ] | 2026-04-14 | Invitation list + create form |
| 15 | `app/admin/links/page.tsx` | [x] | [x] | [x] | [x] | [ ] | 2026-04-14 | Was partially migrated; fixed shell, table, status badges |
| 16 | `app/admin/links/new/page.tsx` | [x] | [x] | — | [x] | [ ] | 2026-04-14 | Short form page |
| 17 | `app/admin/links/[id]/activity/page.tsx` | [ ] | [ ] | [ ] | [ ] | [ ] | | |
| 18 | `app/admin/api-keys/page.tsx` | [ ] | [ ] | [ ] | [ ] | [ ] | | |
| 19 | `app/admin/api-keys/[id]/page.tsx` | [ ] | [ ] | — | [ ] | [ ] | | |
| 20 | `app/admin/email/page.tsx` | [ ] | [ ] | — | [ ] | [ ] | | |
| 21 | `app/profile/page.tsx` | [ ] | [ ] | — | [ ] | [ ] | | |
| 22 | `app/printer/configure/page.tsx` | [ ] | [ ] | [ ] | [ ] | [ ] | | |
| 23 | `app/printer/test/page.tsx` | [ ] | [ ] | — | [ ] | [ ] | | |
| 24 | `app/login/page.tsx` | [ ] | [ ] | — | [ ] | [ ] | | Auth page |
| 25 | `app/register/page.tsx` | [ ] | [ ] | — | [ ] | [ ] | | Auth page |
| 26 | `app/verify-email/page.tsx` | [ ] | [ ] | — | [ ] | [ ] | | Auth page |
| 27 | `app/forgot-password/page.tsx` | [ ] | [ ] | — | [ ] | [ ] | | Auth page |
| 28 | `app/reset-password/page.tsx` | [ ] | [ ] | — | [ ] | [ ] | | Auth page |
| 29 | `app/about/page.tsx` | [ ] | [ ] | — | [ ] | [ ] | | Thin wrapper — migrate when AboutContent is migrated |
| 30 | `app/logo-lab/page.tsx` | [ ] | [ ] | — | [ ] | [ ] | | |
| 31 | `app/client-auth/[id]/page.tsx` | [ ] | [ ] | — | [ ] | [ ] | | |
| 32 | `app/page.tsx` | [ ] | [ ] | — | [ ] | [ ] | | Root/landing |

---

## globals.css Shim Removal Checklist

_The `!important` override block in globals.css can be removed only after these are all confirmed migrated:_

- [ ] All pages above marked done
- [ ] Header, PrinterStatusBanner, ReloadButton migrated
- [ ] No remaining `bg-white`, `bg-gray-50`, `text-gray-900`, `text-gray-600` in JSX (run grep to verify)
- [ ] `:root.light` block removed from globals.css
- [ ] Tailwind override shim block removed from globals.css

---

## Lessons Learned / Plan Amendments

_Add notes here when a migration reveals something the plan didn't anticipate._

| Date | Finding |
|---|---|
| 2026-04-09 | **`group`/`group-hover:` color classes are unremapped** — the globals.css shim catches `.text-blue-600` but not `.group-hover\:text-blue-600`. Use CSS parent-child hover rules in semantic.css instead. |
| 2026-04-09 | **Component classes own complete visual treatment** — `.page-title` and `.design-card-title` include font-size and font-weight, not just color. JSX doesn't need `text-3xl font-bold` alongside `.page-title`. Plan updated. |
| 2026-04-09 | **`hover:border-blue-300`/`hover:text-blue-700` also unremapped** — any `hover:`, `focus:`, `group-hover:` Tailwind color variant is not covered by the shim. Always use semantic CSS for hover color changes. |
