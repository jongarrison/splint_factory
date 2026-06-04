interface Props {
  printAcceptance?: string | null;
  // When provided, shows as a tooltip on the badge.
  printNote?: string | null;
}

// Shared badge for print review outcome (Accept, Reject Print, Reject Design, Archive).
export default function PrintAcceptanceBadge({ printAcceptance, printNote }: Props) {
  const tooltip = printNote || undefined;
  const helpClass = tooltip ? ' cursor-help' : '';

  if (printAcceptance === 'ACCEPTED') {
    return <span className={`status-badge status-success${helpClass}`} title={tooltip}>Accepted</span>;
  }
  if (printAcceptance === 'REJECT_DESIGN') {
    return <span className={`status-badge status-warning${helpClass}`} title={tooltip}>Rejected - Design</span>;
  }
  if (printAcceptance === 'REJECT_PRINT') {
    return <span className={`status-badge status-error${helpClass}`} title={tooltip}>Rejected - Print</span>;
  }
  if (printAcceptance === 'ARCHIVED') {
    return <span className={`status-badge status-neutral${helpClass}`} title={tooltip}>Archived</span>;
  }
  // Legacy fallback for records written before REJECT_PRINT/REJECT_DESIGN distinction.
  if (printAcceptance === 'REJECTED') {
    return <span className={`status-badge status-error${helpClass}`} title={tooltip}>Rejected</span>;
  }
  return null;
}
