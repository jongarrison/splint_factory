'use client';

import { useState } from 'react';

type DeleteAction = 'DELETE' | 'REJECT_DESIGN' | 'REJECT_PRINT';

interface DeletePrintModalProps {
  printId: string;
  geometryName: string;
  printStarted?: boolean;
  onClose: () => void;
  onSubmit: (printId: string, action: DeleteAction) => Promise<void>;
}

export default function DeletePrintModal({
  printId,
  geometryName,
  printStarted,
  onClose,
  onSubmit,
}: DeletePrintModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleAction = async (action: DeleteAction) => {
    setSubmitting(true);
    try {
      await onSubmit(printId, action);
      onClose();
    } catch (error) {
      console.error('Error deleting print:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={submitting}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Title */}
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900">Remove Print Job</h2>
          <p className="text-sm text-gray-600 mt-1">{geometryName}</p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleAction('DELETE')}
            disabled={submitting}
            className="w-full bg-gray-700 hover:bg-gray-800 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : null}
            Delete
          </button>
          <button
            onClick={() => handleAction('REJECT_DESIGN')}
            disabled={submitting}
            className="w-full bg-orange-700 hover:bg-orange-800 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : null}
            Reject Design
          </button>
          {printStarted && (
            <button
              onClick={() => handleAction('REJECT_PRINT')}
              disabled={submitting}
              className="w-full bg-rose-700 hover:bg-rose-800 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : null}
              Reject Print
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
