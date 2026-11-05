'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  PrinterAlert,
  resolvePrinterError,
} from '@/lib/printer-error-catalog';

interface PrinterAlertEvent {
  type: string;
  payload?: {
    action?: 'opened' | 'updated' | 'cleared';
    alert?: PrinterAlert;
  };
}

type FailureClassification = 'FAILED' | 'OPERATOR_CANCELLED' | 'AMBIGUOUS_STOP';
type RecoveryStatus = Awaited<ReturnType<Window['electronAPI']['printer']['getRecoveryStatus']>>;

function getRawCode(alert: PrinterAlert): string | null {
  if (alert.kind === 'hms') {
    return typeof alert.raw.code === 'string' ? alert.raw.code : null;
  }
  if (alert.kind === 'print_error') {
    const value = typeof alert.raw.value === 'number' ? alert.raw.value : null;
    const hex = typeof alert.raw.hex === 'string' ? alert.raw.hex : null;
    return value === null ? hex : `${value}${hex ? ` (${hex})` : ''}`;
  }
  return null;
}

function getLastProgress(alert: PrinterAlert): number | null {
  const interval = alert.raw.interval;
  if (!interval || typeof interval !== 'object') return null;
  const progress = (interval as Record<string, unknown>).progress;
  return typeof progress === 'number' ? progress : null;
}

/**
 * Present one active condition using Factory-owned copy while Electron retains safety state.
 */
function PrinterErrorModal({
  alert,
  onClose,
  onFailAndReplace,
  recoveryState,
  classification,
  onClassificationChange,
  printerRecovery,
  countdownSeconds,
  onStopNow,
  stopError,
  objectId,
}: {
  alert: PrinterAlert;
  onClose: () => void;
  onFailAndReplace: () => Promise<void>;
  recoveryState: { pending: boolean; replacementId?: string; error?: string };
  classification: FailureClassification;
  onClassificationChange: (value: FailureClassification) => void;
  printerRecovery: RecoveryStatus;
  countdownSeconds: number | null;
  onStopNow: () => Promise<void>;
  stopError?: string;
  objectId?: string | null;
}) {
  const catalogEntry = resolvePrinterError(alert);
  const rawCode = getRawCode(alert);
  const lastProgress = getLastProgress(alert);
  const articleUrl = `${window.location.origin}${catalogEntry.articlePath}`;
  const canFailAndReplace = alert.blocking &&
    Boolean(alert.printJobId) &&
    alert.kind !== 'filename_mismatch';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-xl rounded-xl border border-[var(--status-error-text)]/50 bg-[var(--surface)] p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--status-error-text)]">
              {alert.blocking ? 'Printing Blocked' : 'Printer Notice'}
            </p>
            <h2 className="text-xl font-semibold text-[var(--text)]">{catalogEntry.title}</h2>
          </div>
          <span className="rounded bg-[var(--status-error-bg)] px-2 py-1 text-xs text-[var(--status-error-text)]">
            {alert.count > 1 ? `${alert.count} reports` : 'Active'}
          </span>
        </div>

        <p className="mb-4 text-sm text-[var(--text-muted)]">{catalogEntry.explanation}</p>

        {alert.printJobId && (
          <p className="mb-3 text-sm text-[var(--text)]">
            Object ID:{' '}
            <span className="font-mono font-semibold">
              {objectId === undefined ? 'Loading...' : objectId || 'Unavailable'}
            </span>
            {lastProgress !== null && <> at {lastProgress}%</>}
          </p>
        )}

        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-[var(--text)]">
          {catalogEntry.immediateSteps.map((step) => <li key={step}>{step}</li>)}
        </ol>

        <div className="mb-4 flex items-center gap-4 rounded-lg bg-[var(--background)] p-3">
          <QRCodeSVG value={articleUrl} size={88} bgColor="transparent" fgColor="currentColor" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text)]">Detailed recovery instructions</p>
            <p className="break-all text-xs text-[var(--text-muted)]">{articleUrl}</p>
          </div>
        </div>

        <details className="mb-4 rounded-lg border border-[var(--border)] p-3">
          <summary className="cursor-pointer text-sm font-medium text-[var(--text)]">Technical details</summary>
          <div className="mt-2 space-y-1 text-xs text-[var(--text-muted)]">
            <p>Alert ID: <span className="font-mono">{alert.id}</span></p>
            {rawCode && <p>Raw code: <span className="font-mono">{rawCode}</span></p>}
            <p>First seen: {new Date(alert.firstSeenAt).toLocaleString()}</p>
            {alert.temps?.bed && (
              <p>Bed: {alert.temps.bed.actual ?? '?'} C / {alert.temps.bed.target ?? '?'} C target</p>
            )}
            {alert.temps?.nozzle && (
              <p>Nozzle: {alert.temps.nozzle.actual ?? '?'} C / {alert.temps.nozzle.target ?? '?'} C target</p>
            )}
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap font-mono">
              {JSON.stringify(alert.raw, null, 2)}
            </pre>
          </div>
        </details>

        <p className="mb-4 text-xs text-[var(--text-muted)]">
          Power cycle: turn the printer off with its physical switch, wait for the display and fans to stop, turn it on, and wait for Splint Queue to confirm it is ready.
        </p>

        {printerRecovery.printJobId === alert.printJobId && printerRecovery.phase !== 'idle' && (
          <div className="mb-4 rounded-lg border border-[var(--status-error-text)]/50 bg-[var(--status-error-bg)] p-3 text-sm text-[var(--text)]">
            {printerRecovery.phase === 'grace_period' && (
              <>
                <p className="font-semibold">
                  Automatic stop in {countdownSeconds ?? 0} seconds if the blocking pause continues.
                </p>
                <button
                  type="button"
                  onClick={onStopNow}
                  className="btn-primary mt-3 w-full py-2 font-semibold"
                >
                  Stop Print Now
                </button>
              </>
            )}
            {printerRecovery.phase === 'stopping' && <p className="font-semibold">Sending stop command...</p>}
            {printerRecovery.phase === 'verifying_stop' && (
              <p className="font-semibold">
                Verifying printer stop and heater targets
                {countdownSeconds !== null ? ` (${countdownSeconds}s remaining)` : ''}...
              </p>
            )}
            {printerRecovery.phase === 'awaiting_power_cycle' && (
              <p className="font-semibold">
                Stop verified and heater targets are zero. Power the printer off, wait for the display and fans to stop, then power it on.
              </p>
            )}
            {printerRecovery.phase === 'power_cycle_disconnected' && (
              <p className="font-semibold">Power cycle detected. Waiting for fresh safe printer status...</p>
            )}
            {printerRecovery.phase === 'urgent_power_off' && (
              <div>
                <p className="text-base font-bold text-[var(--status-error-text)]">
                  Urgent: switch off the printer with its physical power switch now.
                </p>
                <p className="mt-1">{printerRecovery.reason}</p>
                <p className="mt-1">Wait for the display and fans to stop before turning it back on.</p>
              </div>
            )}
            {stopError && <p className="mt-2 text-[var(--status-error-text)]">{stopError}</p>}
          </div>
        )}

        {canFailAndReplace && (
          <div className="mb-3">
            <label className="mb-2 block text-sm text-[var(--text)]">
              Outcome
              <select
                value={classification}
                onChange={(event) => onClassificationChange(event.target.value as FailureClassification)}
                disabled={recoveryState.pending || Boolean(recoveryState.replacementId)}
                className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--text)]"
              >
                <option value="FAILED">Confirmed failure</option>
                <option value="OPERATOR_CANCELLED">Stopped by operator</option>
                <option value="AMBIGUOUS_STOP">Stopped unexpectedly</option>
              </select>
            </label>
            <button
              type="button"
              onClick={onFailAndReplace}
              disabled={recoveryState.pending || Boolean(recoveryState.replacementId)}
              className="btn-primary w-full py-2 text-sm font-semibold disabled:opacity-50"
            >
              {recoveryState.pending
                ? 'Recording Failure...'
                : recoveryState.replacementId
                  ? `Replacement Created${objectId ? ` for Object ${objectId}` : ''}`
                  : 'Mark Failed and Create Replacement'}
            </button>
            {recoveryState.error && (
              <p className="mt-2 text-xs text-[var(--status-error-text)]">{recoveryState.error}</p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="btn-alt w-full py-2 text-sm font-semibold"
        >
          {alert.blocking ? 'Hide Details' : 'Acknowledge'}
        </button>
      </div>
    </div>
  );
}

/**
 * Replay Electron-retained alerts after navigation and keep the modal synchronized with IPC.
 */
export default function PrinterErrorModalListener() {
  const [alerts, setAlerts] = useState<PrinterAlert[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [recoveryState, setRecoveryState] = useState<{
    pending: boolean;
    replacementId?: string;
    error?: string;
  }>({ pending: false });
  const [classification, setClassification] = useState<FailureClassification>('FAILED');
  const [printerRecovery, setPrinterRecovery] = useState<RecoveryStatus>({ phase: 'idle' });
  const [now, setNow] = useState(() => Date.now());
  const [stopError, setStopError] = useState<string>();
  const [auditRetry, setAuditRetry] = useState(0);
  const postedAuditKeys = useRef(new Set<string>());
  const [objectIds, setObjectIds] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const api = window.electronAPI?.printer;
    if (!api?.getActiveAlerts || !api?.onAlert) return;

    let active = true;
    api.getActiveAlerts().then((current) => {
      if (active) setAlerts(current);
    }).catch((error) => {
      console.error('Failed to load active printer alerts:', error);
    });

    const unsubscribe = api.onAlert((event: PrinterAlertEvent) => {
      if (event.type !== 'printer-alert' || !event.payload?.alert || !event.payload.action) return;
      const { action, alert } = event.payload;
      setAlerts((current) => {
        if (action === 'cleared') return current.filter((item) => item.id !== alert.id);
        const remaining = current.filter((item) => item.id !== alert.id);
        return [...remaining, alert].sort(
          (a, b) => Number(b.blocking) - Number(a.blocking) || a.firstSeenAt - b.firstSeenAt
        );
      });
      if (action === 'cleared') {
        setHiddenIds((current) => {
          const next = new Set(current);
          next.delete(alert.id);
          return next;
        });
      }
    });
    const unsubscribeRecovery = api.subscribeToRecoveryStatus(setPrinterRecovery);

    return () => {
      active = false;
      unsubscribe();
      unsubscribeRecovery();
    };
  }, []);

  useEffect(() => {
    const printJobIds = [...new Set(
      alerts.map((alert) => alert.printJobId).filter((id): id is string => Boolean(id))
    )];
    const missingIds = printJobIds.filter((id) => !(id in objectIds));
    if (missingIds.length === 0) return;

    let cancelled = false;
    Promise.all(missingIds.map(async (printJobId) => {
      try {
        const response = await fetch(`/api/print-queue/${printJobId}`);
        if (!response.ok) return [printJobId, null] as const;
        const entry = await response.json();
        const objectId = typeof entry.designJob?.objectId === 'string'
          ? entry.designJob.objectId
          : null;
        return [printJobId, objectId] as const;
      } catch (error) {
        console.error('Failed to resolve Object ID for printer alert:', error);
        return [printJobId, null] as const;
      }
    })).then((resolved) => {
      if (!cancelled) {
        setObjectIds((current) => ({ ...current, ...Object.fromEntries(resolved) }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [alerts, objectIds]);

  useEffect(() => {
    if (!['grace_period', 'verifying_stop'].includes(printerRecovery.phase)) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [printerRecovery.phase]);

  useEffect(() => {
    const auditEvent = printerRecovery.auditEvents?.find(
      (event) => !postedAuditKeys.current.has(event.eventKey)
    );
    if (!auditEvent) return;

    let cancelled = false;
    let retryTimer: number | undefined;
    const postAudit = async () => {
      try {
        const environment = await window.electronAPI.getEnvironmentInfo();
        const response = await fetch(
          `/api/print-queue/${auditEvent.printJobId}/recovery-event`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Device-ID': environment.deviceId,
            },
            body: JSON.stringify({
              eventKey: auditEvent.eventKey,
              eventType: auditEvent.eventType,
              evidence: auditEvent.evidence,
            }),
          }
        );
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Failed to persist recovery audit');
        }
        const acknowledgement =
          await window.electronAPI.printer.acknowledgeRecoveryAudit(auditEvent.eventKey);
        if (!acknowledgement.acknowledged) {
          throw new Error('Electron did not acknowledge the persisted recovery audit');
        }
        postedAuditKeys.current.add(auditEvent.eventKey);
      } catch (error) {
        console.error('Failed to persist printer recovery audit:', error);
        if (!cancelled) {
          retryTimer = window.setTimeout(() => setAuditRetry((value) => value + 1), 5000);
        }
      }
    };
    postAudit();

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [auditRetry, printerRecovery.auditEvents]);

  const visibleAlert = useMemo(
    () => alerts.find((alert) => !hiddenIds.has(alert.id)) || null,
    [alerts, hiddenIds]
  );

  useEffect(() => {
    setRecoveryState({ pending: false });
    setClassification(visibleAlert?.kind === 'ambiguous_stop' ? 'AMBIGUOUS_STOP' : 'FAILED');
    setStopError(undefined);
  }, [visibleAlert?.id, visibleAlert?.kind]);

  const countdownDeadline = printerRecovery.phase === 'grace_period'
    ? printerRecovery.deadline
    : printerRecovery.phase === 'verifying_stop'
      ? printerRecovery.verificationDeadline
      : undefined;
  const countdownSeconds = countdownDeadline === undefined
    ? null
    : Math.max(0, Math.ceil((countdownDeadline - now) / 1000));

  if (!visibleAlert) {
    if (printerRecovery.phase !== 'recovered_safe') return null;
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4">
        <div className="w-full max-w-md rounded-xl border border-[var(--status-success-text)]/50 bg-[var(--surface)] p-5 shadow-2xl">
          <h2 className="text-xl font-semibold text-[var(--text)]">Printer Recovery Verified</h2>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            The printer reconnected with a fresh idle state, no active file or errors, and zero heater targets. Printing is available again.
          </p>
          <button
            type="button"
            onClick={() => window.electronAPI.printer.acknowledgeRecovery()}
            className="btn-primary mt-4 w-full py-2 text-sm font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const handleClose = async () => {
    if (visibleAlert.blocking) {
      setHiddenIds((current) => new Set(current).add(visibleAlert.id));
      return;
    }

    const result = await window.electronAPI.printer.acknowledgeAlert(visibleAlert.id);
    if (result.acknowledged) {
      setAlerts((current) => current.filter((alert) => alert.id !== visibleAlert.id));
    }
  };

  const handleFailAndReplace = async () => {
    if (!visibleAlert.printJobId || !window.electronAPI?.printing?.getFailureEvidence) return;
    setRecoveryState({ pending: true });
    try {
      const evidence = await window.electronAPI.printing.getFailureEvidence(visibleAlert.printJobId);
      if (!evidence) throw new Error('Electron no longer has evidence for this print attempt.');
      const environment = await window.electronAPI.getEnvironmentInfo();

      const response = await fetch(`/api/print-queue/${visibleAlert.printJobId}/fail-and-replace`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': environment.deviceId,
        },
        body: JSON.stringify({
          classification,
          evidence,
          idempotencyKey: `printer-alert:${visibleAlert.id}:${visibleAlert.printJobId}`,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create replacement.');
      setRecoveryState({ pending: false, replacementId: result.replacement.id });
    } catch (error) {
      console.error('Failed to record print failure:', error);
      setRecoveryState({
        pending: false,
        error: error instanceof Error ? error.message : 'Failed to create replacement.',
      });
    }
  };

  const handleStopNow = async () => {
    setStopError(undefined);
    const result = await window.electronAPI.printing.stopPrint();
    if (!result.success) {
      setStopError(result.error || 'The printer did not accept the stop command.');
    }
  };

  return (
    <PrinterErrorModal
      alert={visibleAlert}
      onClose={handleClose}
      onFailAndReplace={handleFailAndReplace}
      recoveryState={recoveryState}
      classification={classification}
      onClassificationChange={setClassification}
      printerRecovery={printerRecovery}
      countdownSeconds={countdownSeconds}
      onStopNow={handleStopNow}
      stopError={stopError}
      objectId={visibleAlert.printJobId ? objectIds[visibleAlert.printJobId] : null}
    />
  );
}
