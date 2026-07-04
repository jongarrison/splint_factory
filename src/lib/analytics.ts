'use client';

import { track } from '@vercel/analytics';

type AnalyticsEventProperties = Record<string, string | number | boolean>;

export function trackEvent(
  eventName: string,
  properties?: AnalyticsEventProperties
): void {
  if (typeof window === 'undefined') return;

  try {
    track(eventName, properties);
  } catch {
    // Never block user flows if analytics transport fails.
  }
}