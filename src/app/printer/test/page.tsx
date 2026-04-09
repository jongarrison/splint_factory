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
      <div className="min-h-screen bg-gray-50">
        <Header variant="browser" />
        <div className="max-w-2xl mx-auto px-4 py-8">
          <p className="text-gray-600">Printer test page is only available in the Electron client.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header variant="electron" />
      <div className="max-w-2xl mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Printer Test</h1>

        {/* G-code input */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            G-code Command
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={gcode}
              onChange={(e) => setGcode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !sending && sendGcode()}
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm font-mono text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="M300 S440 P200"
            />
          </div>
          <button
              onClick={sendGcode}
              disabled={sending || !gcode.trim()}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
        </div>

        {/* Presets */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-sm font-medium text-gray-700 mb-2">Presets</h2>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.gcode}
                onClick={() => { setGcode(p.gcode); }}
                className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-1.5 rounded-md transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* LED Controls */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="text-sm font-medium text-gray-700 mb-2">LED Controls</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => sendLedCommand('work_light', 'on')}
              className="bg-yellow-500 hover:bg-yellow-400 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
            >
              Work Light ON
            </button>
            <button
              onClick={() => sendLedCommand('work_light', 'off')}
              className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
            >
              Work Light OFF
            </button>
            <button
              onClick={() => sendLedCommand('chamber_light', 'on')}
              className="bg-yellow-500 hover:bg-yellow-400 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
            >
              Chamber Light ON
            </button>
            <button
              onClick={() => sendLedCommand('chamber_light', 'off')}
              className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
            >
              Chamber Light OFF
            </button>
          </div>
        </div>

        {/* Log output */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-medium text-gray-700">Log</h2>
            <button
              onClick={() => setLog([])}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          </div>
          <div className="bg-gray-900 rounded-md p-3 h-48 overflow-y-auto font-mono text-xs text-green-400">
            {log.length === 0 ? (
              <span className="text-gray-500">No commands sent yet</span>
            ) : (
              log.map((line, i) => <div key={i}>{line}</div>)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
