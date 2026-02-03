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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!session?.user || session.user.role !== 'SYSTEM_ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen bg-surface-secondary">
      <Header />
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-primary">Link Tracking</h1>
          <Link
            href="/admin/links/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create New Link
          </Link>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            Error: {error}
          </div>
        )}

        {links.length === 0 ? (
          <div className="bg-surface border border-gray-300 rounded-lg p-8 text-center">
            <p className="text-primary font-semibold mb-4">No links created yet.</p>
            <Link
              href="/admin/links/new"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Your First Link
            </Link>
          </div>
        ) : (
          <div className="bg-surface border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shortcode
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Target
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Clicks
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-gray-200">
                {links.map((link) => (
                  <tr key={link.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => copyToClipboard(link.shortcode)}
                        className="text-blue-600 hover:text-blue-800 font-mono font-medium"
                        title="Click to copy full URL"
                      >
                        {link.shortcode}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      {link.title || <span className="text-gray-400 italic">No title</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded ${
                        link.linkType === 'EXTERNAL_URL' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {link.linkType === 'EXTERNAL_URL' ? 'URL' : 'File'}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate" title={link.linkTarget}>
                      {link.linkTarget}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold">{link.clickCount}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded ${
                        link.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {link.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/admin/links/${link.id}/activity`}
                        className="text-blue-600 hover:text-blue-800 mr-3"
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
