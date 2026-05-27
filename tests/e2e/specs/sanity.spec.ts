import { test, expect } from '@playwright/test';
import { login } from '../fixtures/auth';
import { INFINITY_FLEX, makeJobLabel } from '../fixtures/test-data';

// Required env. playwright.config.ts loads .env.e2e.local then .env.e2e.example.
const EMAIL = process.env.E2E_USER_EMAIL!;
const PASSWORD = process.env.E2E_USER_PASSWORD!;
const DESIGN_NAME = process.env.E2E_DESIGN_NAME || INFINITY_FLEX.designName;

test.describe('sanity: full design-job-to-print-queue flow', () => {
  test.beforeAll(() => {
    if (!EMAIL || !PASSWORD) {
      throw new Error(
        'Missing E2E_USER_EMAIL / E2E_USER_PASSWORD. Copy .env.e2e.example to .env.e2e.local and fill in.'
      );
    }
  });

  test('member can create an InfinityFlex job and see it land in the print queue', async ({ page }) => {
    const jobLabel = makeJobLabel();
    test.info().annotations.push({ type: 'jobLabel', description: jobLabel });

    // 1. Login.
    await login(page, EMAIL, PASSWORD);

    // 2. Pick the InfinityFlex design from the design menu.
    await page.goto('/design-menu');
    await expect(page.getByTestId('design-menu-page')).toBeVisible();
    const card = page.getByTestId('design-menu-card').filter({ hasText: DESIGN_NAME }).first();
    await expect(card, `design card "${DESIGN_NAME}" should be present`).toBeVisible();
    await card.click();

    // 3. Fill the new design job form.
    await expect(page.getByTestId('new-design-job-page')).toBeVisible();
    await page.getByTestId('job-label-input').fill(jobLabel);
    for (const [inputName, value] of Object.entries(INFINITY_FLEX.params)) {
      // Inputs use id === InputName (see design-jobs/new/page.tsx).
      await page.locator(`#${inputName}`).fill(String(value));
    }
    await page.getByTestId('submit-btn').click();

    // 4. Should redirect to the detail page: /design-jobs/<id>.
    await page.waitForURL(/\/design-jobs\/[^/]+$/, { timeout: 30_000 });
    const detailUrl = page.url();
    const jobId = detailUrl.split('/').pop()!;
    test.info().annotations.push({ type: 'designJobId', description: jobId });

    // 5. Wait for geometry processing to reach "completed".
    // Processor polls roughly every 5s; total wait budget = 3 minutes.
    const statusBadge = page.getByTestId('design-job-status');
    await expect(statusBadge).toBeVisible();
    await expect
      .poll(
        async () => {
          // Re-fetch detail page so server-side status is fresh.
          await page.reload();
          return await statusBadge.getAttribute('data-status');
        },
        {
          message: `Geo processing did not complete for job ${jobId} within timeout`,
          timeout: 3 * 60 * 1000,
          intervals: [5_000],
        }
      )
      .toBe('completed');

    // 6. Job should now appear in the print queue (active view) with a Print button.
    await page.goto('/print-queue');
    await expect(page.getByTestId('print-queue-page')).toBeVisible();
    await page.getByTestId('view-mode-active-btn').click();

    const row = page.getByTestId('print-queue-row').filter({
      has: page.locator(`[data-job-label="${jobLabel}"]`),
    });
    // Pi-flavoured fallback: the filter above matches because the row carries
    // data-job-label itself; if Playwright resolves before the row renders, retry.
    const rowByAttr = page.locator(`[data-testid="print-queue-row"][data-job-label="${jobLabel}"]`);
    await expect(rowByAttr, `print queue row for "${jobLabel}" should be visible`).toBeVisible({
      timeout: 20_000,
    });

    // Print button must be rendered (it is disabled in non-Electron browsers, but presence is enough).
    await expect(rowByAttr.getByTestId('print-btn')).toBeVisible();
  });
});
