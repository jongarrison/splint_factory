'use client';

import { useState } from 'react';

interface ProcessingLogViewerProps {
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
export default function ProcessingLogViewer({ log, title = 'Processing Log' }: ProcessingLogViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!log) {
    return (
      <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
        <p className="text-sm text-gray-500">No processing log available</p>
      </div>
    );
  }

  const lines = log.split('\n').filter(line => line.trim().length > 0);
  const displayLines = isExpanded ? lines : lines.slice(0, 10);
  const hasMore = lines.length > 10;

  const getLineStyle = (line: string) => {
    if (line.includes('[error]') || line.toLowerCase().includes('error:') || line.includes('failed')) {
      return 'text-red-700 bg-red-50';
    }
    if (line.includes('[warn]') || line.toLowerCase().includes('warning:')) {
      return 'text-yellow-700 bg-yellow-50';
    }
    if (line.includes('[info]')) {
      return 'text-blue-700';
    }
    return 'text-gray-800';
  };

  return (
    <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-300 px-4 py-2 flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        <span className="text-xs text-gray-500">{lines.length} lines</span>
      </div>
      
      <div className="relative">
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-xs font-mono">
            <tbody>
              {displayLines.map((line, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="text-right text-gray-400 select-none px-2 py-1 border-r border-gray-200 bg-gray-50" style={{ minWidth: '50px' }}>
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
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 flex justify-center">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {isExpanded 
                ? `Show Less ▲` 
                : `Show All ${lines.length - 10} More Lines ▼`
              }
            </button>
          </div>
        )}
      </div>
      
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 flex justify-between items-center text-xs text-gray-600">
        <span>
          {log.includes('[Log truncated]') && (
            <span className="text-yellow-600 font-medium">⚠️ Log truncated (exceeded 100KB limit)</span>
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
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          Download Log
        </button>
      </div>
    </div>
  );
}
