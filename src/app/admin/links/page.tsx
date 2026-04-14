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
  _count: {
    activity: number;
  };
}

export default function LinksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [links, setLinks] = useState<LinkData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user || session.user.role !== 'SYSTEM_ADMIN') {
      router.push('/');
      return;
    }

    fetchLinks();
  }, [session, status, router]);

  const fetchLinks = async () => {
    try {
      const response = await fetch('/api/admin/links');
      if (!response.ok) throw new Error('Failed to fetch links');
      const data = await response.json();
      setLinks(data.links);
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
      <div className="page-shell flex items-center justify-center" data-testid="links-loading">
        <div className="text-lg text-secondary">Loading...</div>
      </div>
    );
  }

  if (!session?.user || session.user.role !== 'SYSTEM_ADMIN') {
    return null;
  }

  return (
    <div className="page-shell" data-testid="links-page">
      <Header />
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="page-title">Link Tracking</h1>
          <Link
            href="/admin/links/new"
            className="btn-primary px-4 py-2"
            data-testid="create-link-btn"
          >
            Create New Link
          </Link>
        </div>

        {error && (
          <div className="alert-error mb-4" data-testid="alert-error">
            Error: {error}
          </div>
        )}

        {links.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-primary font-semibold mb-4">No links created yet.</p>
            <Link
              href="/admin/links/new"
              className="btn-primary inline-block px-4 py-2"
            >
              Create Your First Link
            </Link>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Shortcode</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Target</th>
                  <th>Clicks</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr key={link.id}>
                    <td>
                      <button
                        onClick={() => copyToClipboard(link.shortcode)}
                        className="text-link font-mono font-medium"
                        title="Click to copy full URL"
                        data-testid="copy-shortcode-btn"
                      >
                        {link.shortcode}
                      </button>
                    </td>
                    <td>
                      {link.title || <span className="text-muted italic">No title</span>}
                    </td>
                    <td>
                      <span className={`status-badge ${
                        link.linkType === 'EXTERNAL_URL'
                          ? 'status-pending'
                          : 'status-success'
                      }`}>
                        {link.linkType === 'EXTERNAL_URL' ? 'URL' : 'File'}
                      </span>
                    </td>
                    <td className="max-w-xs truncate" title={link.linkTarget}>
                      {link.linkTarget}
                    </td>
                    <td>
                      <span className="font-semibold">{link.clickCount}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${
                        link.isActive ? 'status-success' : 'status-neutral'
                      }`}>
                        {link.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/admin/links/${link.id}/activity`}
                        className="text-link hover:underline"
                        data-testid="view-activity-link"
                      >
                        View Activity
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
