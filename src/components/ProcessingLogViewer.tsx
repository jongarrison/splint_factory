'use client';

import { useState } from 'react';

interface processingLogViewerProps {
  log: string | null | undefined;
  title?: string;
}

/**
 * Component for displaying processing logs with nice formatting
 * Features:
 * - Monospace font for readability
 * - Line numbers
 * - Collapsible/expandable view
 * - Auto-scroll to bottom
 * - Highlight error/warning lines
 */
export default function processingLogViewer({ log, title = 'Processing Log' }: processingLogViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!log) {
    return (
      <div className="bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg p-4">
        <h3 className="text-sm font-medium text-secondary mb-2">{title}</h3>
        <p className="text-sm text-muted">No processing log available</p>
      </div>
    );
  }

  const lines = log.split('\n').filter(line => line.trim().length > 0);
  const displayLines = isExpanded ? lines : lines.slice(0, 10);
  const hasMore = lines.length > 10;

  const getLineStyle = (line: string) => {
    if (line.includes('[error]') || line.toLowerCase().includes('error:') || line.includes('failed')) {
      return 'text-[var(--status-error-text)] bg-[var(--status-error-text)]/10';
    }
    if (line.includes('[warn]') || line.toLowerCase().includes('warning:')) {
      return 'text-[var(--status-warning-text)] bg-[var(--status-warning-text)]/10';
    }
    if (line.includes('[info]')) {
      return 'text-[var(--accent-blue)]';
    }
    return 'text-primary';
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
      <div className="bg-[var(--surface-secondary)] border-b border-[var(--border)] px-4 py-2 flex justify-between items-center">
        <h3 className="text-sm font-medium text-secondary">{title}</h3>
        <span className="text-xs text-muted">{lines.length} lines</span>
      </div>
      
      <div className="relative">
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-xs font-mono">
            <tbody>
              {displayLines.map((line, index) => (
                <tr key={index} className="border-b border-[var(--border)]/50 hover:bg-[var(--surface-secondary)]">
                  <td className="text-right text-muted select-none px-2 py-1 border-r border-[var(--border)] bg-[var(--surface-secondary)]" style={{ minWidth: '50px' }}>
                    {index + 1}
                  </td>
                  <td className={`px-3 py-1 whitespace-pre-wrap ${getLineStyle(line)}`}>
                    {line}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {hasMore && (
          <div className="border-t border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2 flex justify-center">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-sm text-link hover:text-[var(--accent-blue-hover)] font-medium">
              {isExpanded 
                ? `Show Less`
                : `Show All ${lines.length - 10} More Lines`
              }
            </button>
          </div>
        )}
      </div>
      
      <div className="bg-[var(--surface-secondary)] border-t border-[var(--border)] px-4 py-2 flex justify-between items-center text-xs text-muted">
        <span>
          {log.includes('[Log truncated]') && (
            <span className="text-[var(--status-warning-text)] font-medium">[!] Log truncated (exceeded 100KB limit)</span>
          )}
        </span>
        <button
          onClick={() => {
            const blob = new Blob([log], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `processing-log-${new Date().toISOString()}.txt`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="text-link hover:text-[var(--accent-blue-hover)] font-medium"
        >
          Download Log
        </button>
      </div>
    </div>
  );
}
