'use client';

import { useState, useRef } from 'react';

type AcceptanceAction = 'ACCEPTED' | 'REJECT_DESIGN' | 'REJECT_PRINT';

interface PrintAcceptanceModalProps {
  printId: string;
  geometryName: string;
  onClose: () => void;
  onSubmit: (printId: string, acceptance: AcceptanceAction, note: string) => Promise<void>;
}

export default function PrintAcceptanceModal({
  printId,
  geometryName,
  onClose,
  onSubmit
}: PrintAcceptanceModalProps) {
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<AcceptanceAction | null>(null);

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const note = noteRef.current?.value || '';
      await onSubmit(printId, selected, note);
      onClose();
    } catch (error) {
      console.error('Error submitting acceptance:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const options: { value: AcceptanceAction; label: string; description: string; color: string; selectedColor: string; ring: string }[] = [
    { value: 'ACCEPTED', label: 'Accept', description: 'Print quality is good',
      color: 'border-[var(--border)] hover:border-[var(--status-success-text)] hover:bg-[var(--status-success-bg)]',
      selectedColor: 'border-[var(--status-success-text)] bg-[var(--status-success-bg)]',
      ring: 'btn-success',
    },
    { value: 'REJECT_DESIGN', label: 'Reject Design', description: 'Design is incorrect or unacceptable',
      color: 'border-[var(--border)] hover:border-orange-400 hover:bg-orange-900/30',
      selectedColor: 'border-orange-400 bg-orange-900/30',
      ring: 'bg-orange-600 hover:bg-orange-700',
    },
    { value: 'REJECT_PRINT', label: 'Reject Print', description: 'Design OK, print quality is bad',
      color: 'border-[var(--border)] hover:border-[var(--status-error-text)] hover:bg-[var(--status-error-bg)]',
      selectedColor: 'border-[var(--status-error-text)] bg-[var(--status-error-bg)]',
      ring: 'btn-danger',
    },
  ];

  const selectedOption = options.find(o => o.value === selected);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card shadow-xl max-w-md w-full p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={submitting}
          className="absolute top-4 right-4 text-muted hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Title */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-primary">Print Review</h2>
          <p className="text-sm text-muted mt-1">{geometryName}</p>
        </div>

        {/* Choice buttons */}
        <div className="flex flex-col gap-2 mb-4">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              disabled={submitting}
              className={`text-left px-4 py-3 rounded-lg border-2 transition-all ${
                selected === opt.value ? opt.selectedColor : opt.color
              } disabled:opacity-50`}
            >
              <div className="font-medium text-primary">{opt.label}</div>
              <div className="text-xs text-muted">{opt.description}</div>
            </button>
          ))}
        </div>

        {/* Note input */}
        <div className="mb-4">
          <label htmlFor="printNote" className="block text-sm font-medium text-secondary mb-1">
            Note (optional)
          </label>
          <textarea
            id="printNote"
            ref={noteRef}
            defaultValue=""
            placeholder="Any details about this decision..."
            rows={2}
            className="input-field text-sm"
            disabled={submitting}
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 btn-neutral font-semibold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selected}
            className={`flex-1 ${
              selectedOption ? selectedOption.ring : 'btn-neutral opacity-50'
            } text-white font-semibold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
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
              selected ? `Confirm ${selectedOption?.label}` : 'Select a decision'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
