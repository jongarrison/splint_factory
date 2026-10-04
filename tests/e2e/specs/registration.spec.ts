import { expect, test } from '@playwright/test';

const PASSWORD = 'Registration123!';

test.describe('invitation registration', () => {
  test('targeted invitation displays its email and does not submit an email override', async ({ page }) => {
    let registrationBody: Record<string, unknown> | undefined;

    await page.route('**/api/invitations/validate?token=targeted-token', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ email: 'invited@example.com', organizationName: 'Test Clinic' }),
      });
    });
    await page.route('**/api/register', async (route) => {
      registrationBody = route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/register?invitation=targeted-token');

    await expect(page.getByText('Test Clinic')).toBeVisible();
    await expect(page.getByTestId('invited-email')).toHaveText('invited@example.com');
    await expect(page.getByTestId('email-input')).toHaveCount(0);

    await page.getByTestId('name-input').fill('Invited User');
    await page.getByTestId('password-input').fill(PASSWORD);
    await page.getByTestId('confirm-password-input').fill(PASSWORD);
    await page.getByTestId('responsibility-acknowledgment-checkbox').check();
    await page.getByTestId('submit-btn').click();

    await expect.poll(() => registrationBody).toBeDefined();
    expect(registrationBody).toMatchObject({
      name: 'Invited User',
      invitationToken: 'targeted-token',
      responsibilityAcknowledged: true,
    });
    expect(registrationBody).not.toHaveProperty('email');
  });

  test('open invitation keeps the email input and submits its value', async ({ page }) => {
    let registrationBody: Record<string, unknown> | undefined;

    await page.route('**/api/invitations/validate?token=open-token', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ email: null, organizationName: 'Test Clinic' }),
      });
    });
    await page.route('**/api/register', async (route) => {
      registrationBody = route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/register?invitation=open-token');
    await expect(page.getByTestId('invited-email')).toHaveCount(0);
    await page.getByTestId('name-input').fill('Open Invite User');
    await page.getByTestId('email-input').fill('open@example.com');
    await page.getByTestId('password-input').fill(PASSWORD);
    await page.getByTestId('confirm-password-input').fill(PASSWORD);
    await page.getByTestId('responsibility-acknowledgment-checkbox').check();
    await page.getByTestId('submit-btn').click();

    await expect.poll(() => registrationBody).toBeDefined();
    expect(registrationBody).toMatchObject({
      email: 'open@example.com',
      invitationToken: 'open-token',
    });
  });

  test('invalid invitation does not render the registration form', async ({ page }) => {
    await page.route('**/api/invitations/validate?token=invalid-token', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid or expired invitation' }),
      });
    });

    await page.goto('/register?invitation=invalid-token');

    await expect(page.getByTestId('register-no-token')).toBeVisible();
    await expect(page.getByTestId('submit-btn')).toHaveCount(0);
  });

  test('verified invitation users retain the existing sign-in path', async ({ page }) => {
    await page.route('**/api/auth/verify-email', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Email verified successfully',
        requiresPasswordSetup: false,
      }),
    }));

    await page.goto('/verify-email?token=invitation-verification-token');

    await expect(page.getByTestId('sign-in-btn')).toBeVisible();
    await expect(page.getByTestId('set-password-btn')).toHaveCount(0);
  });
});