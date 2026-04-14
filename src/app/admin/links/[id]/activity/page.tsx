'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';

interface LinkData {
  id: string;
  shortcode: string;
  linkType: string;
  linkTarget: string;
  title: string | null;
  isActive: boolean;
  clickCount: number;
  createdAt: string;
  creator: {
    name: string | null;
    email: string;
  };
}

interface Activity {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  referer: string | null;
  visitTime: string;
}

export default function LinkActivityPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [link, setLink] = useState<LinkData | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user || session.user.role !== 'SYSTEM_ADMIN') {
      router.push('/');
      return;
    }

    fetchActivity();
  }, [session, status, router, params.id]);

  const fetchActivity = async () => {
    try {
      const response = await fetch(`/api/admin/links/${params.id}/activity`);
      if (!response.ok) throw new Error('Failed to fetch activity');
      const data = await response.json();
      setLink(data.link);
      setActivity(data.activity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (shortcode: string) => {
    const url = `${window.location.origin}/l/${shortcode}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => alert('Link copied to clipboard!'))
        .catch((err) => {
          console.error('Failed to copy:', err);
          fallbackCopy(url);
        });
    } else {
      fallbackCopy(url);
    }
  };

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      alert('Link copied to clipboard!');
    } catch (err) {
      console.error('Fallback copy failed:', err);
      alert(`Copy this link: ${text}`);
    }
    document.body.removeChild(textArea);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="page-shell flex items-center justify-center" data-testid="activity-loading">
        <div className="text-lg text-secondary">Loading...</div>
      </div>
    );
  }

  if (!session?.user || session.user.role !== 'SYSTEM_ADMIN') {
    return null;
  }

  if (error || !link) {
    return (
      <div className="page-shell">
        <Header />
        <div className="container mx-auto p-6 max-w-7xl">
          <div className="alert-error" data-testid="alert-error">
            Error: {error || 'Link not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell" data-testid="activity-page">
      <Header />
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6">
          <Link href="/admin/links" className="text-link hover:underline mb-4 inline-block">
            ← Back to Links
          </Link>
          <h1 className="page-title">Link Activity</h1>
        </div>

        {/* Link Details Card */}
        <div className="card p-6 mb-6" data-testid="link-details-card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted">Shortcode</h3>
              <button
                onClick={() => copyToClipboard(link.shortcode)}
                className="text-lg font-mono text-link hover:underline"
                title="Click to copy full URL"
                data-testid="copy-shortcode-btn"
              >
                /l/{link.shortcode}
              </button>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted">Title</h3>
              <p className="text-lg text-primary">{link.title || <span className="text-muted italic">No title</span>}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted">Type</h3>
              <span className={`status-badge ${
                link.linkType === 'EXTERNAL_URL' ? 'status-pending' : 'status-success'
              }`}>
                {link.linkType === 'EXTERNAL_URL' ? 'External URL' : 'Hosted File'}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted">Target</h3>
              <p className="text-lg text-primary break-all">{link.linkTarget}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted">Total Clicks</h3>
              <p className="text-2xl font-bold text-link">{link.clickCount}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted">Status</h3>
              <span className={`status-badge ${
                link.isActive ? 'status-success' : 'status-neutral'
              }`}>
                {link.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div className="card overflow-hidden" data-testid="activity-log">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-xl font-semibold text-primary">Recent Activity (Last 100 visits)</h2>
          </div>
          
          {activity.length === 0 ? (
            <div className="p-8 text-center text-muted">
              No visits yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Visit Time</th>
                    <th>IP Address</th>
                    <th>User Agent</th>
                    <th>Referer</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((visit) => (
                    <tr key={visit.id}>
                      <td className="whitespace-nowrap text-sm">
                        {new Date(visit.visitTime).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap text-sm font-mono">
                        {visit.ipAddress || 'unknown'}
                      </td>
                      <td className="text-sm max-w-md truncate" title={visit.userAgent || undefined}>
                        {visit.userAgent || '-'}
                      </td>
                      <td className="text-sm max-w-xs truncate" title={visit.referer || undefined}>
                        {visit.referer || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
