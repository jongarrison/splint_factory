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
  rejectedCount: number;
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
      rejectedCount: acc.rejectedCount + row.rejectedCount,
    }),
    { printCount: 0, acceptedCount: 0, rejectedCount: 0 }
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <button
          onClick={() => router.push('/admin/organizations')}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
        >
          &larr; Back to Organizations
        </button>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {org && (
          <>
            {/* Org header */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-6">
              <div className="px-6 py-4 flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {org.name}
                  </h1>
                  {org.description && (
                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                      {org.description}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
                    {org._count.users} member{org._count.users !== 1 ? 's' : ''}
                    {!org.isActive && (
                      <span className="ml-2 inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                        Inactive
                      </span>
                    )}
                  </p>
                </div>
                <Link
                  href={`/admin/organizations/${orgId}/edit`}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded"
                >
                  Edit
                </Link>
              </div>
            </div>

            {/* Print stats table */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Print Summary
                </h2>
              </div>

              {stats.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  No prints recorded for this organization yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Design Name
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Print Count
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Accepted
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Rejected
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {stats.map((row) => (
                        <tr key={row.designName}>
                          <td className="px-6 py-3 text-sm text-gray-900 dark:text-gray-100">
                            {row.designName}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-900 dark:text-gray-100 text-right">
                            {row.printCount}
                          </td>
                          <td className="px-6 py-3 text-sm text-green-700 dark:text-green-400 text-right">
                            {row.acceptedCount}
                          </td>
                          <td className="px-6 py-3 text-sm text-red-700 dark:text-red-400 text-right">
                            {row.rejectedCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 dark:bg-gray-900 font-semibold">
                        <td className="px-6 py-3 text-sm text-gray-900 dark:text-gray-100">
                          Total
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-900 dark:text-gray-100 text-right">
                          {totals.printCount}
                        </td>
                        <td className="px-6 py-3 text-sm text-green-700 dark:text-green-400 text-right">
                          {totals.acceptedCount}
                        </td>
                        <td className="px-6 py-3 text-sm text-red-700 dark:text-red-400 text-right">
                          {totals.rejectedCount}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Devices table */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg mt-6">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Client Devices
                </h2>
              </div>

              {devices.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  No devices registered for this organization.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Device
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Current Operator
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Last Seen
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {devices.map((device) => (
                        <tr key={device.id}>
                          <td className="px-6 py-3 text-sm text-gray-900 dark:text-gray-100">
                            <div className="font-medium">{device.name}</div>
                            <div className="text-xs text-gray-400 font-mono">{device.id.slice(0, 8)}...</div>
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-900 dark:text-gray-100">
                            {device.currentOperator ? (
                              <div>
                                <div>{device.currentOperator.name || device.currentOperator.email}</div>
                                {device.operatorValidatedAt && (
                                  <div className="text-xs text-gray-400">
                                    since {new Date(device.operatorValidatedAt).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">None</span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">
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
