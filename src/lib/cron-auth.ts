export type CronAuthorizationFailure = 'missing-secret' | 'unauthorized';

/** Validates Vercel Cron's bearer token without coupling callers to Next.js. */
export function getCronAuthorizationFailure(
  request: Pick<Request, 'headers'>,
  secret: string | undefined = process.env.CRON_SECRET,
): CronAuthorizationFailure | null {
  if (!secret) {
    return 'missing-secret';
  }

  return request.headers.get('authorization') === `Bearer ${secret}`
    ? null
    : 'unauthorized';
}
