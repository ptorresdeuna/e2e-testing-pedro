// Cross Domain Login restores the user bound to the device-fingerprint visitorId that
// POST /users/probe returns (sent back as X-Session-ID). Every headless Chromium on a
// machine gets the same visitorId, and the backend keeps it bound to the first user that
// logs in with it until that user logs out: a later OTP login does not take it over. So
// once any other test leaves a user logged in on the shared visitorId, reopening the
// checkout restores that user, the email no longer matches the order and the widget asks
// for the OTP again. A visitorId unique to this browser context gives the test its own
// session. See docs/flaky-test-patterns.md, pattern 18b.
import { randomUUID } from 'crypto';
import { BrowserContext } from '@playwright/test';

export const isolateCdlSession = async (context: BrowserContext) => {
  const visitorId = randomUUID();
  await context.route('**/users/probe', (route) =>
    route.fulfill({ json: { code: 'success', data: { visitorId } } })
  );
};
