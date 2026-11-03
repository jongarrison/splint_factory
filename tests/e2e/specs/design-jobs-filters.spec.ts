import { test, expect } from '@playwright/test';
import { login } from '../fixtures/auth';

const EMAIL = process.env.E2E_USER_EMAIL!;
const PASSWORD = process.env.E2E_USER_PASSWORD!;

test.describe('design jobs filters', () => {
  test.beforeAll(() => {
    if (!EMAIL || !PASSWORD) {
      throw new Error('Missing E2E_USER_EMAIL / E2E_USER_PASSWORD.');
    }
  });

  test('member stays organization-scoped and can use the compact filters', async ({ page }) => {
    await login(page, EMAIL, PASSWORD);
    await page.goto('/design-jobs');

    await expect(page.getByTestId('design-jobs-page')).toBeVisible();
    await expect(page.getByTestId('organization-filter-container')).toHaveCount(0);
    await expect(page.getByTestId('expanded-filters')).not.toBeVisible();

    const allOrganizationsResponse = await page.request.get('/api/design-jobs?organizationId=all');
    expect(allOrganizationsResponse.status()).toBe(403);
    const allOptionsResponse = await page.request.get('/api/design-jobs/filter-options?organizationId=all');
    expect(allOptionsResponse.status()).toBe(403);

    await page.getByTestId('toggle-filters-btn').click();
    await expect(page.getByTestId('expanded-filters')).toBeVisible();
    await expect(page.getByTestId('sort-order')).toHaveValue('newest');
    await expect(page.getByTestId('design-filter').locator('option')).not.toHaveCount(1);

    await page.getByTestId('object-id-search-input').fill('__NO_MATCH__');
    await expect(page.getByTestId('filters-label')).toHaveText('Filters');
    await page.getByTestId('apply-filters-btn').click();
    await expect(page.getByTestId('filters-label')).toHaveText('Filters (1)');
    await expect(page.getByTestId('design-jobs-empty')).toContainText('No design jobs match');
    await page.getByTestId('clear-filters-btn').click();
    await expect(page.getByTestId('filters-label')).toHaveText('Filters');

    const rows = page.getByTestId('design-job-row');
    if (await rows.count()) {
      const firstRow = rows.first();
      await expect(firstRow).toHaveAttribute('data-job-id', /.+/);
      await expect(firstRow).toHaveAttribute('data-design-id', /.+/);
      await expect(firstRow).toHaveAttribute('data-status', /.+/);
      await expect(firstRow).toHaveAttribute('data-created-at', /.+/);
      await expect(firstRow).toHaveAttribute('data-organization-id', /.+/);
    }
  });
});