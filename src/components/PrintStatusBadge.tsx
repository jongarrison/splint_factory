interface Props {
  printStartedAt?: string | null;
  printCompletedAt?: string | null;
  isPrintSuccessful: boolean;
  progress?: number | null;
}

// Shared badge for print job execution status (not acceptance/review outcome).
export default function PrintStatusBadge({ printStartedAt, printCompletedAt, isPrintSuccessful, progress }: Props) {
  if (printCompletedAt && isPrintSuccessful) {
    return <span className="status-badge status-success">Print Successful</span>;
  }
  if (printCompletedAt && !isPrintSuccessful) {
    return <span className="status-badge status-error">Print Failed</span>;
  }
  if (printStartedAt) {
    const progressText = progress != null ? `${Math.floor(progress)}%` : null;
    return (
      <span className="status-badge status-warning">
        Printing
        {progressText && (
          <>
            {'\u00A0'}
            <span className="progress-percentage">{progressText}</span>
          </>
        )}
      </span>
    );
  }
  return <span className="status-badge status-pending">Ready to Print</span>;
}
