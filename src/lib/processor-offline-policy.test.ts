import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatProcessorOfflineDuration,
  getProcessorOfflineAlertKind,
} from './processor-offline-policy';

const thresholdMs = 10 * 60 * 1000;
const reminderIntervalMs = 60 * 60 * 1000;
const now = new Date('2026-11-15T12:00:00.000Z');

test('does not alert for a recent heartbeat', () => {
  assert.equal(getProcessorOfflineAlertKind({
    lastPingAt: new Date(now.getTime() - thresholdMs + 1),
    lastOfflineAlertSentAt: null,
  }, now, thresholdMs, reminderIntervalMs), null);
});

test('requests an initial alert at the offline threshold', () => {
  assert.equal(getProcessorOfflineAlertKind({
    lastPingAt: new Date(now.getTime() - thresholdMs),
    lastOfflineAlertSentAt: null,
  }, now, thresholdMs, reminderIntervalMs), 'initial');
});

test('waits for the reminder interval after an alert', () => {
  assert.equal(getProcessorOfflineAlertKind({
    lastPingAt: new Date(now.getTime() - 2 * thresholdMs),
    lastOfflineAlertSentAt: new Date(now.getTime() - reminderIntervalMs + 1),
  }, now, thresholdMs, reminderIntervalMs), null);

  assert.equal(getProcessorOfflineAlertKind({
    lastPingAt: new Date(now.getTime() - 2 * thresholdMs),
    lastOfflineAlertSentAt: new Date(now.getTime() - reminderIntervalMs),
  }, now, thresholdMs, reminderIntervalMs), 'reminder');
});

test('formats time since the last heartbeat instead of time since detection', () => {
  assert.equal(formatProcessorOfflineDuration(10 * 60 * 1000 + 42 * 1000), '10m 42s');
});
