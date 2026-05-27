import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

// Logs in via the credentials form on /login.
// Asserts that we land on an authenticated page (any non-/login URL).
export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);
  await page.getByTestId('submit-btn').click();

  // NextAuth redirects to home (or wherever) on success; wait for nav off /login.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });

  // Sanity: header user info present (proves session is live).
  // No strict text assertion — just confirms we're not bounced back.
  await expect(page).not.toHaveURL(/\/login/);
}
