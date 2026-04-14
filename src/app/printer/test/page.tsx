'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/navigation/Header';

export default function PrinterTestPage() {
  const [isElectronClient, setIsElectronClient] = useState(false);
  const [gcode, setGcode] = useState('M300 S440 P200');
  const [log, setLog] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setIsElectronClient(typeof window !== 'undefined' && !!(window as any).electronAPI);
  }, []);

  const addLog = (msg: string) => {
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const sendGcode = async () => {
    if (!gcode.trim()) return;
    setSending(true);
    addLog(`Sending: ${gcode}`);
    try {
      const electronAPI = (window as any).electronAPI;
      const result = await electronAPI.printing.sendGcode(gcode.trim());
      if (result.success) {
        addLog('OK');
      } else {
        addLog(`Error: ${result.error}`);
      }
    } catch (err: any) {
      addLog(`Exception: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const sendLedCommand = async (node: string, mode: string) => {
    addLog(`LED: ${node} -> ${mode}`);
    try {
      const electronAPI = (window as any).electronAPI;
      const result = await electronAPI.printing.setLed(node, mode);
      if (result.success) {
        addLog('OK');
      } else {
        addLog(`Error: ${result.error}`);
      }
    } catch (err: any) {
      addLog(`Exception: ${err.message}`);
    }
  };

  // Preset beep patterns
  const presets = [
    { label: 'Beep 440Hz', gcode: 'M300 S440 P200' },
    { label: 'Beep 880Hz', gcode: 'M300 S880 P200' },
    { label: 'Beep 1000Hz', gcode: 'M300 S1000 P150' },
    { label: 'Low tone', gcode: 'M300 S220 P500' },
    { label: 'Home XY', gcode: 'G28 X Y' },
  ];

  if (!isElectronClient) {
    return (
      <div className="page-shell" data-testid="printer-test-unavailable">
        <Header variant="browser" />
        <div className="max-w-2xl mx-auto px-4 py-8">
          <p className="text-muted">Printer test page is only available in the Electron client.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell" data-testid="printer-test-page">
      <Header variant="electron" />
      <div className="max-w-2xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-primary mb-4">Printer Test</h1>

        {/* G-code input */}
        <div className="card p-4 mb-4" data-testid="gcode-card">
          <label className="block text-sm font-medium text-secondary mb-1">
            G-code Command
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={gcode}
              onChange={(e) => setGcode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !sending && sendGcode()}
              className="input-field text-sm font-mono flex-1"
              data-testid="gcode-input"
              placeholder="M300 S440 P200"
            />
          </div>
          <button
              onClick={sendGcode}
              disabled={sending || !gcode.trim()}
              className="btn-primary px-4 py-2 text-sm"
              data-testid="send-gcode-btn"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
        </div>

        {/* Presets */}
        <div className="card p-4 mb-4">
          <h2 className="text-sm font-medium text-secondary mb-2">Presets</h2>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.gcode}
                onClick={() => { setGcode(p.gcode); }}
                className="btn-neutral text-sm px-3 py-1.5"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* LED Controls */}
        <div className="card p-4 mb-4">
          <h2 className="text-sm font-medium text-secondary mb-2">LED Controls</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => sendLedCommand('work_light', 'on')}
              className="btn-success text-sm font-medium px-3 py-1.5"
            >
              Work Light ON
            </button>
            <button
              onClick={() => sendLedCommand('work_light', 'off')}
              className="btn-neutral text-sm font-medium px-3 py-1.5"
            >
              Work Light OFF
            </button>
            <button
              onClick={() => sendLedCommand('chamber_light', 'on')}
              className="btn-success text-sm font-medium px-3 py-1.5"
            >
              Chamber Light ON
            </button>
            <button
              onClick={() => sendLedCommand('chamber_light', 'off')}
              className="btn-neutral text-sm font-medium px-3 py-1.5"
            >
              Chamber Light OFF
            </button>
          </div>
        </div>

        {/* Log output */}
        <div className="card p-4" data-testid="log-card">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-medium text-secondary">Log</h2>
            <button
              onClick={() => setLog([])}
              className="text-xs text-muted hover:text-primary"
            >
              Clear
            </button>
          </div>
          <div className="bg-[var(--background)] border border-[var(--border)] rounded-md p-3 h-48 overflow-y-auto font-mono text-xs text-green-400">
            {log.length === 0 ? (
              <span className="text-muted">No commands sent yet</span>
            ) : (
              log.map((line, i) => <div key={i}>{line}</div>)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
