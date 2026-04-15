'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '@/components/navigation/Header';

interface PrinterSnapshot {
  id: string;
  firmware: string;
  modules: Record<string, string> | null;
  amsConfig: Record<string, unknown> | null;
  networkIp: string | null;
  activeHmsErrors: Array<{ code: string; message: string }> | null;
  funField: string | null;
  capturedAt: string;
  deviceId: string;
}

interface FleetPrinter {
  serial: string;
  model: string;
  name: string | null;
  lastSnapshotAt: string | null;
  device: {
    id: string;
    name: string;
    organizationName: string | null;
  } | null;
  latestSnapshot: PrinterSnapshot | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h ago`;
  const mins = Math.floor(diff / 60000);
  return `${mins}m ago`;
}

function SnapshotHistory({ serial }: { serial: string }) {
  const [snapshots, setSnapshots] = useState<PrinterSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/printer-snapshots?printer=${serial}`)
      .then(res => res.json())
      .then(data => { setSnapshots(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [serial]);

  if (loading) return <div className="text-secondary text-sm py-2">Loading...</div>;
  if (snapshots.length === 0) return <div className="text-secondary text-sm py-2">No snapshots recorded</div>;

  return (
    <div className="mt-2 space-y-2">
      {snapshots.map(s => (
        <div key={s.id} className="bg-[var(--surface)] rounded px-3 py-2 text-sm">
          <div className="flex justify-between text-secondary">
            <span>FW: {s.firmware}</span>
            <span>{new Date(s.capturedAt).toLocaleDateString()} {new Date(s.capturedAt).toLocaleTimeString()}</span>
          </div>
          {s.modules && (
            <div className="text-secondary mt-1">
              Modules: {Object.entries(s.modules).map(([k, v]) => `${k}=${v}`).join(', ')}
            </div>
          )}
          {s.networkIp && <div className="text-secondary">IP: {s.networkIp}</div>}
          {s.activeHmsErrors && s.activeHmsErrors.length > 0 && (
            <div className="text-[var(--status-error)] mt-1">
              HMS: {s.activeHmsErrors.map((e: { code: string; message: string }) => `${e.code} - ${e.message}`).join('; ')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function FleetPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [fleet, setFleet] = useState<FleetPrinter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPrinter, setExpandedPrinter] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user || session.user.role !== 'SYSTEM_ADMIN') {
      router.push('/');
      return;
    }
    fetchFleet();
  }, [session, status, router]);

  const fetchFleet = async () => {
    try {
      const res = await fetch('/api/printer-snapshots');
      if (!res.ok) throw new Error('Failed to fetch fleet data');
      const data = await res.json();
      setFleet(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIndicator = (printer: FleetPrinter) => {
    if (!printer.latestSnapshot) return { label: 'No data', color: 'text-secondary' };
    const daysSince = printer.lastSnapshotAt
      ? (Date.now() - new Date(printer.lastSnapshotAt).getTime()) / 86400000
      : Infinity;
    const hasErrors = printer.latestSnapshot.activeHmsErrors && printer.latestSnapshot.activeHmsErrors.length > 0;
    if (hasErrors) return { label: 'HMS Errors', color: 'text-[var(--status-error)]' };
    if (daysSince > 10) return { label: 'Stale', color: 'text-[var(--status-warning)]' };
    return { label: 'OK', color: 'text-[var(--status-success)]' };
  };

  if (status === 'loading' || loading) {
    return (
      <>
        <Header />
        <main className="container-wide py-8">
          <div className="text-secondary">Loading fleet data...</div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="container-wide py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-primary">Printer Fleet</h1>
          <button
            onClick={fetchFleet}
            className="btn-secondary text-sm"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-[var(--status-error-bg)] text-[var(--status-error)] p-3 rounded mb-4">
            {error}
          </div>
        )}

        {fleet.length === 0 ? (
          <div className="text-secondary text-center py-12">
            No printers registered yet. Printers appear here once a client device reports a snapshot.
          </div>
        ) : (
          <div className="space-y-3">
            {fleet.map(printer => {
              const statusInfo = getStatusIndicator(printer);
              const isExpanded = expandedPrinter === printer.serial;

              return (
                <div key={printer.serial} className="bg-[var(--surface-secondary)] rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedPrinter(isExpanded ? null : printer.serial)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--surface)]"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <span className={`font-mono text-sm ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-primary">
                          {printer.name || printer.serial}
                          <span className="text-secondary text-sm ml-2">{printer.model}</span>
                        </div>
                        <div className="text-secondary text-sm">
                          {printer.device?.name ?? 'No device'}
                          {printer.device?.organizationName && (
                            <span className="ml-2">({printer.device.organizationName})</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      {printer.latestSnapshot && (
                        <div className="text-sm">
                          <div className="text-secondary">FW {printer.latestSnapshot.firmware}</div>
                          <div className="text-secondary text-xs">
                            {timeAgo(printer.latestSnapshot.capturedAt)}
                          </div>
                        </div>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-3 border-t border-[var(--border)]">
                      <div className="grid grid-cols-2 gap-4 py-3 text-sm">
                        <div>
                          <span className="text-secondary">Serial:</span>{' '}
                          <span className="font-mono text-primary">{printer.serial}</span>
                        </div>
                        <div>
                          <span className="text-secondary">Network IP:</span>{' '}
                          <span className="font-mono text-primary">
                            {printer.latestSnapshot?.networkIp ?? 'Unknown'}
                          </span>
                        </div>
                        {printer.latestSnapshot?.modules && (
                          <div className="col-span-2">
                            <span className="text-secondary">Modules:</span>{' '}
                            <span className="text-primary">
                              {Object.entries(printer.latestSnapshot.modules)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(' | ')}
                            </span>
                          </div>
                        )}
                      </div>
                      <h3 className="text-sm font-medium text-secondary mt-2">Snapshot History</h3>
                      <SnapshotHistory serial={printer.serial} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
