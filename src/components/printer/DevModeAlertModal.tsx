'use client';

import { useState, useEffect } from 'react';

interface DevModeAlertProps {
  firmwareVersion: string | null;
  hmsErrors: { code: string; message: string }[];
  onAcknowledge: () => void;
}

function DevModeAlertModal({ firmwareVersion, hmsErrors, onAcknowledge }: DevModeAlertProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[var(--surface)] border border-[var(--status-warning-text)]/50 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
        <h2 className="text-lg font-semibold text-[var(--status-warning-text)] mb-2">
          Printer Settings Required
        </h2>

        {firmwareVersion && (
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Firmware was updated to <span className="font-mono">{firmwareVersion}</span>.
            Firmware updates may reset Developer Mode to OFF.
          </p>
        )}

        {hmsErrors.length > 0 && (
          <div className="mb-4 p-3 bg-[var(--status-error-bg)] rounded-lg">
            <p className="text-xs font-medium text-[var(--status-error-text)] mb-1">HMS Error(s) detected:</p>
            {hmsErrors.map((e) => (
              <p key={e.code} className="text-xs text-[var(--status-error-text)] font-mono">
                {e.code} — {e.message}
              </p>
            ))}
          </div>
        )}

        <p className="text-sm text-[var(--text)] font-medium mb-3">
          Ensure LAN Mode and Developer Mode are ON:
        </p>

        <ol className="text-sm text-[var(--text-muted)] space-y-1 list-decimal list-inside mb-6">
          <li>On the printer display, scroll to the circle-with-dot icon</li>
          <li>Arrow right into that menu, then down to <strong className="text-[var(--text)]">WLAN</strong></li>
          <li>Arrow right into WLAN settings</li>
          <li>Confirm <strong className="text-[var(--text)]">LAN Only Mode</strong> is ON</li>
          <li>Scroll to the bottom of the list</li>
          <li>Confirm <strong className="text-[var(--text)]">Developer Mode</strong> is ON</li>
        </ol>

        <button
          onClick={onAcknowledge}
          className="w-full py-2 rounded-lg bg-[var(--status-warning-text)] text-black font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          I&apos;ve checked — dismiss
        </button>
      </div>
    </div>
  );
}

// Self-contained: subscribes to printer-alert IPC events and renders the modal when needed
export default function DevModeAlertListener() {
  const [alert, setAlert] = useState<DevModeAlertProps | null>(null);

  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.printer?.onAlert) return;

    const unsubscribe = electronAPI.printer.onAlert((incoming: { type: string; payload: any }) => {
      if (incoming.type === 'dev-mode-alert') {
        setAlert({
          firmwareVersion: incoming.payload.firmwareVersion,
          hmsErrors: incoming.payload.hmsErrors ?? [],
          onAcknowledge: () => {}, // filled below
        });
      }
    });

    return unsubscribe;
  }, []);

  if (!alert) return null;

  const handleAcknowledge = () => {
    const electronAPI = (window as any).electronAPI;
    electronAPI?.printer?.acknowledgeDEVModeAlert?.();
    setAlert(null);
  };

  return (
    <DevModeAlertModal
      firmwareVersion={alert.firmwareVersion}
      hmsErrors={alert.hmsErrors}
      onAcknowledge={handleAcknowledge}
    />
  );
}
