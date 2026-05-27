'use client';

import { useEffect, useState } from 'react';

interface PrintConfirmModalProps {
  geometryName: string;
  onClose: () => void;
  onConfirm: (runCalibration: boolean) => void;
}

export default function PrintConfirmModal({
  geometryName,
  onClose,
  onConfirm,
}: PrintConfirmModalProps) {
  const [runCalibration, setRunCalibration] = useState(false);

  // Helper to drive the chamber light. Resolves silently — failures are
  // logged but never block the user's flow. The splint_client IPC handler
  // resolves with { success, error } rather than rejecting, so we inspect
  // the result explicitly.
  const setChamberLight = async (mode: 'on' | 'off') => {
    // setLed lives on the `printing` namespace in splint_client/preload.js
    const setLed = (window as any)?.electronAPI?.printing?.setLed;
    if (typeof setLed !== 'function') {
      console.log(`[PrintConfirmModal] setLed bridge unavailable; skipping ${mode}`);
      return;
    }
    console.log(`[PrintConfirmModal] requesting chamber_light ${mode}`);
    try {
      const result = await setLed('chamber_light', mode);
      if (result?.success) {
        console.log(`[PrintConfirmModal] chamber_light ${mode} OK`);
      } else {
        console.warn(`[PrintConfirmModal] chamber_light ${mode} failed:`, result);
      }
    } catch (err) {
      console.warn(`[PrintConfirmModal] chamber_light ${mode} threw:`, err);
    }
  };

  // Turn the chamber light on when the modal opens so the operator can
  // visually inspect the print bed. Turn it off again on unmount so we don't
  // leave it on after Cancel, close, or successful confirm.
  useEffect(() => {
    void setChamberLight('on');
    return () => {
      void setChamberLight('off');
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card shadow-xl max-w-sm w-full p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-secondary transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Title */}
        <div className="mb-4">
          <h2 className="text-lg font-bold text-primary">Start Print</h2>
          <p className="text-sm text-secondary mt-1">{geometryName}</p>
        </div>

        {/* Print bed guidance */}
        <div className="alert-info text-sm mb-4">
          Please ensure the print bed is clean before continuing.
        </div>

        {/* Calibration checkbox */}
        <label className="flex items-start gap-3 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={runCalibration}
            onChange={(e) => setRunCalibration(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <div>
            <span className="text-sm font-medium text-primary">
              Run printer calibration (~5 minutes)
            </span>
            <p className="text-xs text-muted mt-0.5">
              Recommended on the first print of the day
            </p>
          </div>
        </label>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="btn-neutral flex-1 font-semibold py-3 px-4 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(runCalibration)}
            className="btn-alt flex-1 font-semibold py-3 px-4 rounded-lg"
          >
            {runCalibration ? 'Calibrate and Print' : 'Print'}
          </button>
        </div>
      </div>
    </div>
  );
}
