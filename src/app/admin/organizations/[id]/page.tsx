'use client';

import { useState, useEffect, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';

interface OrgDetail {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  _count: { users: number };
}

interface DesignPrintStats {
  designName: string;
  printCount: number;
  acceptedCount: number;
  rejectDesignCount: number;
  rejectPrintCount: number;
  rejectedLegacyCount: number;
}

interface DeviceInfo {
  id: string;
  name: string;
  currentOperator: { name: string; email: string } | null;
  operatorValidatedAt: string | null;
  lastSeenAt: string;
  createdAt: string;
}

export default function OrganizationViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const resolvedParams = use(params);
  const orgId = resolvedParams.id;

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [stats, setStats] = useState<DesignPrintStats[]>([]);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) {
      router.push('/login');
      return;
    }
    fetchData();
  }, [status, session, router, orgId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [orgRes, statsRes, devicesRes] = await Promise.all([
        fetch(`/api/organizations/${orgId}`),
        fetch(`/api/organizations/${orgId}/print-stats`),
        fetch(`/api/organizations/${orgId}/devices`),
      ]);

      if (!orgRes.ok) throw new Error('Failed to load organization');
      if (!statsRes.ok) throw new Error('Failed to load print stats');

      const orgData = await orgRes.json();
      const statsData = await statsRes.json();
      const devicesData = devicesRes.ok ? await devicesRes.json() : [];

      setOrg(orgData);
      setStats(statsData);
      setDevices(devicesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Totals row
  const totals = stats.reduce(
    (acc, row) => ({
      printCount: acc.printCount + row.printCount,
      acceptedCount: acc.acceptedCount + row.acceptedCount,
      rejectDesignCount: acc.rejectDesignCount + row.rejectDesignCount,
      rejectPrintCount: acc.rejectPrintCount + row.rejectPrintCount,
      rejectedLegacyCount: acc.rejectedLegacyCount + row.rejectedLegacyCount,
    }),
    { printCount: 0, acceptedCount: 0, rejectDesignCount: 0, rejectPrintCount: 0, rejectedLegacyCount: 0 }
  );

  if (loading) {
    return (
      <div className="page-shell" data-testid="org-view-loading">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-muted">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell" data-testid="org-view-page">
      <Header />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <button
          onClick={() => router.push('/admin/organizations')}
          className="text-sm text-link hover:underline mb-4 inline-block"
          data-testid="back-btn"
        >
          &larr; Back to Organizations
        </button>

        {error && (
          <div className="alert-error mb-6" data-testid="alert-error">
            {error}
          </div>
        )}

        {org && (
          <>
            {/* Org header */}
            <div className="card mb-6" data-testid="org-header-card">
              <div className="px-6 py-4 flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-primary">
                    {org.name}
                  </h1>
                  {org.description && (
                    <p className="mt-1 text-secondary">
                      {org.description}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-muted">
                    {org._count.users} member{org._count.users !== 1 ? 's' : ''}
                    {!org.isActive && (
                      <span className="ml-2 status-badge status-error">
                        Inactive
                      </span>
                    )}
                  </p>
                </div>
                <Link
                  href={`/admin/organizations/${orgId}/edit`}
                  className="btn-primary px-4 py-2 text-sm"
                  data-testid="edit-org-btn"
                >
                  Edit
                </Link>
              </div>
            </div>

            {/* Print stats table */}
            <div className="card" data-testid="print-stats-card">
              <div className="card-header">
                <h2 className="text-lg font-medium text-primary">
                  Print Summary
                </h2>
              </div>

              {stats.length === 0 ? (
                <div className="px-6 py-8 text-center text-muted">
                  No prints recorded for this organization yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table" data-testid="print-stats-table">
                    <thead>
                      <tr>
                        <th className="px-6 py-3">Design Name</th>
                        <th className="px-6 py-3 text-right">Print Count</th>
                        <th className="px-6 py-3 text-right">Accepted</th>
                        <th className="px-6 py-3 text-right">Design Rejected</th>
                        <th className="px-6 py-3 text-right">Print Rejected</th>
                        <th className="px-6 py-3 text-right">Rejected (Legacy)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map((row) => (
                        <tr key={row.designName}>
                          <td className="px-6 py-3 text-sm text-primary">
                            {row.designName}
                          </td>
                          <td className="px-6 py-3 text-sm text-primary text-right">
                            {row.printCount}
                          </td>
                          <td className="px-6 py-3 text-sm text-right text-[var(--status-success-text)]">
                            {row.acceptedCount}
                          </td>
                          <td className="px-6 py-3 text-sm text-right text-[var(--status-warning-text)]">
                            {row.rejectDesignCount}
                          </td>
                          <td className="px-6 py-3 text-sm text-right text-[var(--status-error-text)]">
                            {row.rejectPrintCount}
                          </td>
                          <td className="px-6 py-3 text-sm text-muted text-right">
                            {row.rejectedLegacyCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[var(--surface-secondary)] font-semibold">
                        <td className="px-6 py-3 text-sm text-primary">
                          Total
                        </td>
                        <td className="px-6 py-3 text-sm text-primary text-right">
                          {totals.printCount}
                        </td>
                        <td className="px-6 py-3 text-sm text-right text-[var(--status-success-text)]">
                          {totals.acceptedCount}
                        </td>
                        <td className="px-6 py-3 text-sm text-right text-[var(--status-warning-text)]">
                          {totals.rejectDesignCount}
                        </td>
                        <td className="px-6 py-3 text-sm text-right text-[var(--status-error-text)]">
                          {totals.rejectPrintCount}
                        </td>
                        <td className="px-6 py-3 text-sm text-muted text-right">
                          {totals.rejectedLegacyCount}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Devices table */}
            <div className="card mt-6" data-testid="devices-card">
              <div className="card-header">
                <h2 className="text-lg font-medium text-primary">
                  Client Devices
                </h2>
              </div>

              {devices.length === 0 ? (
                <div className="px-6 py-8 text-center text-muted">
                  No devices registered for this organization.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table" data-testid="devices-table">
                    <thead>
                      <tr>
                        <th className="px-6 py-3">Device</th>
                        <th className="px-6 py-3">Current Operator</th>
                        <th className="px-6 py-3">Last Seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devices.map((device) => (
                        <tr key={device.id}>
                          <td className="px-6 py-3 text-sm text-primary">
                            <div className="font-medium">{device.name}</div>
                            <div className="text-xs text-muted font-mono">{device.id.slice(0, 8)}...</div>
                          </td>
                          <td className="px-6 py-3 text-sm text-primary">
                            {device.currentOperator ? (
                              <div>
                                <div>{device.currentOperator.name || device.currentOperator.email}</div>
                                {device.operatorValidatedAt && (
                                  <div className="text-xs text-muted">
                                    since {new Date(device.operatorValidatedAt).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted">None</span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-sm text-muted">
                            {new Date(device.lastSeenAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
