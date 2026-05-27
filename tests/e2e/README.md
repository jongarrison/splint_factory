# splint_factory E2E tests

End-to-end smoke tests driving the real factory UI with Playwright.

## Setup (once)

```sh
cd /Users/jon/work_3d/splint_work/splint_factory
npm install
npx playwright install chromium

# Create your local credentials file
cp .env.e2e.example .env.e2e.local
# edit .env.e2e.local — fill in E2E_USER_PASSWORD
```

The test user (default `jon+localtester@splintfactory.com`) and org
(`Automated Test Clinic`) must already exist in the target database.

## Run

```sh
npm run test:e2e            # local, headless (E2E_BASE_URL from .env.e2e.local)
npm run test:e2e:headed     # local, watch in a real browser
npm run test:e2e:prod       # against https://splintfactory.com (creates real data)
npm run test:e2e:report     # open the last HTML report
```

Override the target ad-hoc:
```sh
E2E_BASE_URL=http://other.host:3000 npm run test:e2e
```

## What the sanity test covers

[specs/sanity.spec.ts](specs/sanity.spec.ts):

1. Login as the member-level test user
2. Pick the "Infinity Flex" design from the design menu
3. Fill the form with a unique label (`e2e-YYMMDDhhmmss-rand`) and the 5 measurements
4. Wait for geo processing to reach `completed` (3 min budget, polls every 5 s)
5. Verify the job lands in the active print queue with a Print button

The test does **not** assert printer-ready state — that requires the Electron
client and is out of scope for this browser-driven smoke test.

## Cleanup

The test never auto-cleans (a failed run should leave evidence). Clean up
manually when needed:

```sh
npm run cleanup:e2e -- --dry-run    # show what would be deleted
npm run cleanup:e2e                 # interactive confirmation

# Different org or prefix
npm run cleanup:e2e -- --org "Automated Test Clinic" --prefix e2e-

# Against prod — point DATABASE_URL at prod first; review --dry-run output carefully
DATABASE_URL='postgresql://...prod...' npm run cleanup:e2e -- --dry-run
```

Every test run uses a label starting with `e2e-` so cleanup is deterministic
and never touches real data.

## Files

| Path | Purpose |
|---|---|
| `playwright.config.ts` (repo root) | Playwright config, loads `.env.e2e.local` |
| `.env.e2e.example` (repo root) | Documented env vars, committed |
| `.env.e2e.local` (repo root) | Real creds, gitignored |
| `tests/e2e/specs/` | Test specs |
| `tests/e2e/fixtures/auth.ts` | Login helper |
| `tests/e2e/fixtures/test-data.ts` | Design params + label generator |
| `scripts/cleanup-e2e-test-data.ts` | Manual cleanup script |

## Conventions for new tests

- Prefer `getByTestId` over CSS/text selectors. Add a `data-testid` to the
  source if the element you need to target doesn't have one.
- Job labels and any other test-created data should be prefixed `e2e-` so
  the cleanup script can find them.
- Keep specs focused — one user-visible flow per spec file.
