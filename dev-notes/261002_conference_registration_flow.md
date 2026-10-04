# Conference Registration Flow

Date: 2026-10-02

## URLs

- `/conference` - Permanent public conference landing and registration URL. Use this URL for QR codes; it does not change when the backing organization changes.
- `/admin` - System admin configuration. Use the **Conference Registration** section to select an organization and enable or disable registration.
- `/design-menu` - Destination after successful active registration and automatic sign-in.
- `/login` - Existing users are redirected here with a message.
- `/forgot-password` - Conference users use this to establish a known password after logging out.
- `/more-information` - Destination for unverified conference users after their 24-hour access period expires.

Production example: `https://splintfactory.com/conference`

## Admin Setup

1. Create or select an active organization with the desired catalog access.
2. Open `/admin` and find **Conference Registration**.
3. Select the conference organization.
4. Enable conference registration and save.

Disabling registration does not remove the public landing page. Changing the selected organization affects only future registrations.

## Attendee Flow

The public form always collects full name and email; phone is optional. Cloudflare Turnstile protects submissions when configured.

### Registration Enabled

1. The attendee accepts the existing responsibility acknowledgment and submits the form.
2. A `MEMBER` account is created in the configured conference organization with a server-generated password.
3. The attendee is automatically signed in and sent to `/design-menu`.
4. A verification email is sent immediately.
5. The attendee can use protected functionality for 24 hours without verifying.
6. After 24 hours, an unverified attendee is redirected to `/more-information`.

If the email already belongs to an account, no new account is created and the attendee is redirected to `/login`. After logging out, conference users can use `/forgot-password` to set a password.

### Registration Disabled

The submission is recorded as an access request. The attendee sees a confirmation page explaining that Splint Factory will follow up, with a link to the main page. No account is created.

## Notifications and Records

- Every conference submission sends an email to `SYSTEM_ADMIN` users with `siteAlertOptIn` enabled.
- Notifications distinguish access requests, created accounts, and existing accounts.
- Submissions are stored in `ConferenceAccessRequest`.
- Responsibility acknowledgments use the existing append-only `UserRegistrationAcknowledgment` record.
- Conference settings are stored in the singleton `SystemSettings` record.

## Deployment

Apply Prisma migration `20261002000000_add_conference_registration` before enabling the flow. Production must have `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, email delivery, and `NEXTAUTH_URL` configured.
