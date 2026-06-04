// Formats a date string consistently across all devices using en-US locale.
// Avoids locale-dependent output (e.g., dd/mm/yyyy on UK-locale Raspberry Pi).
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
