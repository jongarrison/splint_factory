'use client';

import { useState, useRef } from 'react';

interface PrintAcceptanceModalProps {
  printId: string;
  geometryName: string;
  isAccepting: boolean; // true for accept, false for reject
  onClose: () => void;
  onSubmit: (printId: string, acceptance: boolean, note: string) => Promise<void>;
}

export default function PrintAcceptanceModal({
  printId,
  geometryName,
  isAccepting,
  onClose,
  onSubmit
}: PrintAcceptanceModalProps) {
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const note = noteRef.current?.value || '';
      await onSubmit(printId, isAccepting, note);
      onClose();
    } catch (error) {
      console.error('Error submitting acceptance:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
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

        {/* Icon and title */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">
            {isAccepting ? '✅' : '❌'}
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${isAccepting ? 'text-green-600' : 'text-red-600'}`}>
            {isAccepting ? 'Accept Print' : 'Reject Print'}
          </h2>
          <p className="text-gray-600">
            {geometryName}
          </p>
        </div>

        {/* Optional note input */}
        <div className="mb-6">
          <label htmlFor="printNote" className="block text-sm font-medium text-gray-700 mb-2">
            Note (optional)
          </label>
          <textarea
            id="printNote"
            ref={noteRef}
            defaultValue=""
            placeholder={isAccepting 
              ? "e.g., Perfect quality, no issues" 
              : "e.g., Layer separation on left side"
            }
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={submitting}
            autoFocus
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`flex-1 ${
              isAccepting
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            } text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </>
            ) : (
              isAccepting ? 'Accept' : 'Reject'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
