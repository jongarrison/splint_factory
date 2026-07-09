# Splint Factory Analytics: Current State

Date: 2026-07-06

## Stack

- Platform: Vercel Web Analytics
- Framework integration: Next.js app-level `<Analytics />`
- Custom event API: `@vercel/analytics` via a local helper (`trackEvent`)

## What Is Tracked Now

### Automatic tracking

- Page views and route/path traffic (via Vercel Analytics)

### Custom events currently instrumented

| Event name | Where it fires | Key properties |
| --- | --- | --- |
| `landing_get_early_access_clicked` | Public landing hero CTA click | `placement` |
| `landing_sign_in_clicked` | Public landing hero CTA click | `placement` |
| `login_submit` | Login form submit | `is_electron`, `has_callback_url` |
| `login_failed` | Login failure | `method`, `reason`, `is_electron` |
| `login_succeeded` | Login success | `method`, `destination_type`, `is_electron` |
| `design_menu_loaded` | Design menu loads | `design_count` |
| `design_selected` | Design selected in menu or new-job form | `source`, `design_id`, `design_slug` |
| `design_job_form_viewed` | New job form first view | `has_design_id`, `from_template` |
| `design_job_create_submitted` | New job submit attempted | `design_id`, `parameter_count`, `has_job_label` |
| `design_job_created` | New job created successfully | `design_id`, `has_job_id` |
| `design_job_create_failed` | New job creation fails | `design_id`, `status_code` |

## Code Locations

- App-wide analytics mount: `src/app/layout.tsx`
- Custom event helper: `src/lib/analytics.ts`
- Instrumented pages:
  - `src/components/landing/AboutContent.tsx`
  - `src/app/login/page.tsx`
  - `src/app/design-menu/page.tsx`
  - `src/app/design-jobs/new/page.tsx`

## How To Use It

1. Open Vercel project dashboard for `splint_factory`.
2. Go to Analytics and set a time window.
3. For public traffic, filter paths such as `/`, `/about`, `/more-information`.
4. For internal usage, filter by route groups such as `/design-menu`, `/design-jobs`, `/admin`, `/print-queue`.
5. Open custom events and filter by the event names above.
6. Compare event counts for simple funnel checks, for example:
   - `login_submit` -> `login_succeeded`
   - `design_selected` -> `design_job_create_submitted` -> `design_job_created`

## Local Development Behavior

- Analytics code is safe in local dev and should not block app behavior if tracking transport fails.
- Use local dev to verify events fire in UI flows.
- Use the Vercel dashboard (deployed environment) for canonical analytics reporting.

## Notes

- Current setup is intentionally lightweight and low-overhead.
- Event properties are limited to operational context (no intentional PII payloads in these event calls).