import { expect, test } from '@playwright/test'

test.describe('conference registration', () => {
  test('records a request and shows confirmation when registration is inactive', async ({ page }) => {
    let requestBody: Record<string, unknown> | undefined

    await page.route('**/api/conference/status', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ registrationEnabled: false }),
    }))
    await page.route('**/api/conference/register', async (route) => {
      requestBody = route.request().postDataJSON()
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ outcome: 'access-request' }),
      })
    })

    await page.goto('/conference')
    await expect(page.getByTestId('conference-acknowledgment')).toHaveCount(0)
    await page.getByTestId('conference-name').fill('Conference Visitor')
    await page.getByTestId('conference-email').fill('visitor@example.com')
    await page.getByTestId('conference-phone').fill('555-0100')
    await page.getByTestId('conference-submit').click()

    await expect(page.getByTestId('conference-thanks')).toBeVisible()
    expect(requestBody).toMatchObject({
      name: 'Conference Visitor',
      email: 'visitor@example.com',
      phone: '555-0100',
      responsibilityAcknowledged: false,
    })
  })

  test('requires and submits the responsibility acknowledgment when active', async ({ page }) => {
    let requestBody: Record<string, unknown> | undefined

    await page.route('**/api/conference/status', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ registrationEnabled: true }),
    }))
    await page.route('**/api/conference/register', async (route) => {
      requestBody = route.request().postDataJSON()
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Test stopped before account creation' }),
      })
    })

    await page.goto('/conference')
    await page.getByTestId('conference-name').fill('New Conference User')
    await page.getByTestId('conference-email').fill('new-user@example.com')
    await page.getByTestId('conference-acknowledgment').check()
    await page.getByTestId('conference-submit').click()

    await expect(page.getByTestId('conference-error')).toBeVisible()
    expect(requestBody).toMatchObject({
      name: 'New Conference User',
      email: 'new-user@example.com',
      responsibilityAcknowledged: true,
    })
  })

  test('redirects an existing account to login with a message', async ({ page }) => {
    await page.route('**/api/conference/status', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ registrationEnabled: true }),
    }))
    await page.route('**/api/conference/register', (route) => route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'ACCOUNT_EXISTS' }),
    }))

    await page.goto('/conference')
    await page.getByTestId('conference-name').fill('Existing User')
    await page.getByTestId('conference-email').fill('existing@example.com')
    await page.getByTestId('conference-acknowledgment').check()
    await page.getByTestId('conference-submit').click()

    await expect(page).toHaveURL(/\/login\?message=/)
    await expect(page.getByTestId('login-message')).toContainText('account already exists')
  })
})
