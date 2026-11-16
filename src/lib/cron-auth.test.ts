import assert from 'node:assert/strict';
import test from 'node:test';
import { getCronAuthorizationFailure } from './cron-auth';

test('authorizes the configured cron bearer token', () => {
  const request = new Request('https://example.com/api/cron/test', {
    headers: { authorization: 'Bearer expected-secret' },
  });

  assert.equal(getCronAuthorizationFailure(request, 'expected-secret'), null);
});

test('rejects missing cron configuration', () => {
  const request = new Request('https://example.com/api/cron/test');

  assert.equal(getCronAuthorizationFailure(request, undefined), 'missing-secret');
});

test('rejects an invalid cron bearer token', () => {
  const request = new Request('https://example.com/api/cron/test', {
    headers: { authorization: 'Bearer wrong-secret' },
  });

  assert.equal(getCronAuthorizationFailure(request, 'expected-secret'), 'unauthorized');
});
