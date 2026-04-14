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
  const [orgScreenLockTimeout, setOrgScreenLockTimeout] = useState('1');
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
      setOrgScreenLockTimeout(String(orgData.screenLockTimeoutMinutes));
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
    parseInt(orgScreenLockTimeout) !== org.screenLockTimeoutMinutes
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
          screenLockTimeoutMinutes: parseInt(orgScreenLockTimeout) || 1,
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
      <div className="page-shell" data-testid="org-edit-loading">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-primary">Loading...</div>
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="page-shell">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-error">
            Organization not found.
          </div>
        </div>
      </div>
    );
  }

  const allChecked = allGeometries.length > 0 && selectedIds.size === allGeometries.length;
  const someChecked = selectedIds.size > 0 && selectedIds.size < allGeometries.length;

  return (
    <div className="page-shell" data-testid="org-edit-page">
      <Header />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <button
          onClick={() => router.push(`/admin/organizations/${orgId}`)}
          className="text-sm text-link hover:underline mb-4 inline-block"
          data-testid="back-btn"
        >
          &larr; Back to Organization
        </button>

        {/* Org details panel */}
        <div className="card mb-6" data-testid="org-details-card">
          <div className="card-header flex justify-between items-center">
            <h2 className="text-lg font-medium text-primary">
              Organization Details
            </h2>
            <button
              onClick={saveOrg}
              disabled={savingOrg || !hasOrgChanges}
              className="btn-primary px-4 py-2 text-sm"
              data-testid="save-details-btn"
            >
              {savingOrg ? 'Saving...' : 'Save Details'}
            </button>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Name
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="input-field text-sm"
                data-testid="org-name-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Description
              </label>
              <input
                type="text"
                value={orgDescription}
                onChange={(e) => setOrgDescription(e.target.value)}
                placeholder="Optional description"
                className="input-field text-sm"
                data-testid="org-desc-input"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="orgActive"
                checked={orgIsActive}
                onChange={(e) => setOrgIsActive(e.target.checked)}
                className="h-4 w-4 rounded"
                data-testid="org-active-checkbox"
              />
              <label htmlFor="orgActive" className="text-sm text-secondary">
                Active
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Screen Lock Timeout (minutes)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={orgScreenLockTimeout}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '' || /^\d+$/.test(raw)) setOrgScreenLockTimeout(raw);
                }}
                onBlur={() => {
                  const val = parseInt(orgScreenLockTimeout);
                  if (isNaN(val) || val < 1) setOrgScreenLockTimeout('1');
                  else if (val > 2147483647) setOrgScreenLockTimeout('2147483647');
                  else setOrgScreenLockTimeout(String(val));
                }}
                className="input-field text-sm w-32"
                data-testid="screen-lock-timeout-input"
              />
              <p className="text-xs text-muted mt-1">
                How long before the touchscreen device locks and requires QR scan to unlock.
              </p>
            </div>
            <p className="text-xs text-muted">
              {org._count.users} member{org._count.users !== 1 ? 's' : ''} &middot; Created{' '}
              {new Date(org.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="alert-error mb-4 flex items-center justify-between" data-testid="alert-error">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-2 hover:opacity-70"
              data-testid="dismiss-error-btn"
            >
              x
            </button>
          </div>
        )}
        {success && (
          <div className="alert-success mb-4" data-testid="alert-success">
            {success}
          </div>
        )}

        {/* Geometry visibility panel */}
        <div className="card" data-testid="visibility-card">
          <div className="card-header flex justify-between items-center">
            <h2 className="text-lg font-medium text-primary">
              Visible Splint Designs
            </h2>
            <button
              onClick={save}
              disabled={saving || !hasChanges}
              className="btn-primary px-4 py-2 text-sm"
              data-testid="save-visibility-btn"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {allGeometries.length === 0 ? (
            <div className="px-6 py-8 text-center text-muted">
              No splint designs have been created yet.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {/* Check-all header row */}
              <label className="flex items-center gap-3 px-6 py-3 bg-[var(--surface-secondary)] cursor-pointer hover:opacity-90">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked;
                  }}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded"
                  data-testid="toggle-all-checkbox"
                />
                <span className="text-sm font-medium text-secondary">
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
                  className="flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-[var(--surface-secondary)]"
                  data-testid="geo-row"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(geo.id)}
                    onChange={() => toggleGeometry(geo.id)}
                    className="h-4 w-4 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-primary">
                        {geo.name}
                      </span>
                      {!geo.isActive && (
                        <span className="status-badge status-warning">
                          Inactive
                        </span>
                      )}
                    </div>
                    {geo.shortDescription && (
                      <p className="text-xs text-muted truncate">
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
