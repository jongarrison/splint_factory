'use client';

import { useState, useEffect, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '@/components/navigation/Header';

interface OrgDetail {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  screenLockTimeoutMinutes: number;
  createdAt: string;
  _count: { users: number };
}

interface GeometrySummary {
  id: string;
  name: string;
  shortDescription: string | null;
  isActive: boolean;
}

export default function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const resolvedParams = use(params);
  const orgId = resolvedParams.id;

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [orgIsActive, setOrgIsActive] = useState(true);
  const [orgScreenLockTimeout, setOrgScreenLockTimeout] = useState(1);
  const [savingOrg, setSavingOrg] = useState(false);
  const [allGeometries, setAllGeometries] = useState<GeometrySummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      const [orgRes, geoRes, visRes] = await Promise.all([
        fetch(`/api/organizations/${orgId}`),
        fetch('/api/admin/design-definitions?all=true'),
        fetch(`/api/organizations/${orgId}/designs`),
      ]);

      if (!orgRes.ok) throw new Error('Failed to fetch organization');
      if (!geoRes.ok) throw new Error('Failed to fetch designs');
      if (!visRes.ok) throw new Error('Failed to fetch visibility settings');

      const orgData: OrgDetail = await orgRes.json();
      const geoData: GeometrySummary[] = await geoRes.json();
      const visData: string[] = await visRes.json();

      setOrg(orgData);
      setOrgName(orgData.name);
      setOrgDescription(orgData.description || '');
      setOrgIsActive(orgData.isActive);
      setOrgScreenLockTimeout(orgData.screenLockTimeoutMinutes);
      setAllGeometries(
        geoData
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setSelectedIds(new Set(visData));
      setSavedIds(new Set(visData));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const toggleGeometry = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === allGeometries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allGeometries.map((g) => g.id)));
    }
  };

  const hasChanges =
    selectedIds.size !== savedIds.size ||
    [...selectedIds].some((id) => !savedIds.has(id));

  const hasOrgChanges = org !== null && (
    orgName !== org.name ||
    orgDescription !== (org.description || '') ||
    orgIsActive !== org.isActive ||
    orgScreenLockTimeout !== org.screenLockTimeoutMinutes
  );

  const saveOrg = async () => {
    setSavingOrg(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orgName,
          description: orgDescription,
          isActive: orgIsActive,
          screenLockTimeoutMinutes: orgScreenLockTimeout,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save organization');
      }
      const updated: OrgDetail = await res.json();
      setOrg(updated);
      setSuccess('Organization details saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSavingOrg(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/organizations/${orgId}/designs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geometryIds: [...selectedIds] }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      setSavedIds(new Set(selectedIds));
      setSuccess('Design visibility saved successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center dark:text-gray-200">Loading...</div>
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-red-600 dark:text-red-400">
            Organization not found.
          </div>
        </div>
      </div>
    );
  }

  const allChecked = allGeometries.length > 0 && selectedIds.size === allGeometries.length;
  const someChecked = selectedIds.size > 0 && selectedIds.size < allGeometries.length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <button
          onClick={() => router.push(`/admin/organizations/${orgId}`)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
        >
          &larr; Back to Organization
        </button>

        {/* Org details panel */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Organization Details
            </h2>
            <button
              onClick={saveOrg}
              disabled={savingOrg || !hasOrgChanges}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white px-4 py-2 rounded text-sm font-medium"
            >
              {savingOrg ? 'Saving...' : 'Save Details'}
            </button>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                type="text"
                value={orgDescription}
                onChange={(e) => setOrgDescription(e.target.value)}
                placeholder="Optional description"
                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="orgActive"
                checked={orgIsActive}
                onChange={(e) => setOrgIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="orgActive" className="text-sm text-gray-700 dark:text-gray-300">
                Active
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Screen Lock Timeout (minutes)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={orgScreenLockTimeout}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (e.target.value === '') setOrgScreenLockTimeout(1);
                  else if (!isNaN(val) && val > 0 && val <= 2147483647) setOrgScreenLockTimeout(val);
                }}
                className="block w-32 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                How long before the touchscreen device locks and requires QR scan to unlock.
              </p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {org._count.users} member{org._count.users !== 1 ? 's' : ''} &middot; Created{' '}
              {new Date(org.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            >
              x
            </button>
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-600 text-green-700 dark:text-green-200 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {/* Geometry visibility panel */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Visible Splint Designs
            </h2>
            <button
              onClick={save}
              disabled={saving || !hasChanges}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white px-4 py-2 rounded text-sm font-medium"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {allGeometries.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
              No splint designs have been created yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {/* Check-all header row */}
              <label className="flex items-center gap-3 px-6 py-3 bg-gray-50 dark:bg-gray-900 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-850">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked;
                  }}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {allChecked
                    ? 'Deselect All'
                    : someChecked
                    ? `${selectedIds.size} of ${allGeometries.length} selected`
                    : 'Select All'}
                </span>
              </label>

              {/* Geometry rows */}
              {allGeometries.map((geo) => (
                <label
                  key={geo.id}
                  className="flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(geo.id)}
                    onChange={() => toggleGeometry(geo.id)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {geo.name}
                      </span>
                      {!geo.isActive && (
                        <span className="inline-flex px-1.5 py-0.5 text-xs font-semibold rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                          Inactive
                        </span>
                      )}
                    </div>
                    {geo.shortDescription && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {geo.shortDescription}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
