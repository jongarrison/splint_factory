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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!session?.user || session.user.role !== 'SYSTEM_ADMIN') {
    return null;
  }

  if (error || !link) {
    return (
      <div>
        <Header />
        <div className="container mx-auto p-6 max-w-7xl">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            Error: {error || 'Link not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-secondary">
      <Header />
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6">
          <Link href="/admin/links" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Links
          </Link>
          <h1 className="text-3xl font-bold text-primary">Link Activity</h1>
        </div>

        {/* Link Details Card */}
        <div className="bg-surface border rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Shortcode</h3>
              <button
                onClick={() => copyToClipboard(link.shortcode)}
                className="text-lg font-mono text-blue-600 hover:text-blue-800"
                title="Click to copy full URL"
              >
                /l/{link.shortcode}
              </button>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Title</h3>
              <p className="text-lg">{link.title || <span className="text-gray-400 italic">No title</span>}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Type</h3>
              <span className={`inline-block px-2 py-1 text-xs rounded ${
                link.linkType === 'EXTERNAL_URL' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {link.linkType === 'EXTERNAL_URL' ? 'External URL' : 'Hosted File'}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Target</h3>
              <p className="text-lg break-all">{link.linkTarget}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Total Clicks</h3>
              <p className="text-2xl font-bold text-blue-600">{link.clickCount}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Status</h3>
              <span className={`inline-block px-2 py-1 text-xs rounded ${
                link.isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {link.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h2 className="text-xl font-semibold">Recent Activity (Last 100 visits)</h2>
          </div>
          
          {activity.length === 0 ? (
            <div className="p-8 text-center text-primary font-semibold">
              No visits yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Visit Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User Agent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Referer
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activity.map((visit) => (
                    <tr key={visit.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {new Date(visit.visitTime).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                        {visit.ipAddress || 'unknown'}
                      </td>
                      <td className="px-6 py-4 text-sm max-w-md truncate" title={visit.userAgent || undefined}>
                        {visit.userAgent || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm max-w-xs truncate" title={visit.referer || undefined}>
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
