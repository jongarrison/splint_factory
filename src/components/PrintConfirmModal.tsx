'use client';

import { useState } from 'react';

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
        <div className="mb-5">
          <h2 className="text-lg font-bold text-primary">Start Print</h2>
          <p className="text-sm text-secondary mt-1">{geometryName}</p>
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
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
