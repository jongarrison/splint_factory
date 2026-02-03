'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '@/components/navigation/Header';

function generateShortcode(length = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function NewLinkPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [shortcode, setShortcode] = useState('');
  const [linkType, setLinkType] = useState<'EXTERNAL_URL' | 'HOSTED_FILE'>('EXTERNAL_URL');
  const [linkTarget, setLinkTarget] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user || session.user.role !== 'SYSTEM_ADMIN') {
      router.push('/');
      return;
    }

    // Generate initial shortcode
    setShortcode(generateShortcode());
  }, [session, status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const response = await fetch('/api/admin/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shortcode,
          linkType,
          linkTarget,
          title: title || null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create link');
      }

      // Success - redirect to links list
      router.push('/admin/links');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSaving(false);
    }
  };

  if (status === 'loading') {
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
      <div className="container mx-auto p-6 max-w-2xl">
        <h1 className="text-3xl font-bold mb-6 text-primary">Create New Link</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-surface border rounded-lg p-6 space-y-6">
          {/* Shortcode */}
          <div>
            <label htmlFor="shortcode" className="block text-sm font-semibold text-primary mb-2">
              Shortcode <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="shortcode"
                value={shortcode}
                onChange={(e) => setShortcode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                required
                pattern="[a-z0-9]+"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="abc123"
              />
              <button
                type="button"
                onClick={() => setShortcode(generateShortcode())}
                className="px-4 py-2 bg-gray-300 text-black rounded-md hover:bg-gray-400 font-semibold"
              >
                Generate
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Your link will be: {window.location.origin}/l/{shortcode || '...'}
            </p>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-semibold text-primary mb-2">
              Title (optional)
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Internal reference name"
            />
          </div>

          {/* Link Type */}
          <div>
            <label className="block text-sm font-semibold text-primary mb-2">
              Link Type <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="EXTERNAL_URL"
                  checked={linkType === 'EXTERNAL_URL'}
                  onChange={(e) => setLinkType(e.target.value as 'EXTERNAL_URL')}
                  className="mr-2"
                />
                External URL
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="HOSTED_FILE"
                  checked={linkType === 'HOSTED_FILE'}
                  onChange={(e) => setLinkType(e.target.value as 'HOSTED_FILE')}
                  className="mr-2"
                />
                Hosted File
              </label>
            </div>
          </div>

          {/* Link Target */}
          <div>
            <label htmlFor="linkTarget" className="block text-sm font-semibold text-primary mb-2">
              {linkType === 'EXTERNAL_URL' ? 'Target URL' : 'Filename'} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="linkTarget"
              value={linkTarget}
              onChange={(e) => setLinkTarget(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={
                linkType === 'EXTERNAL_URL' 
                  ? 'https://example.com' 
                  : 'document.pdf'
              }
            />
            {linkType === 'HOSTED_FILE' && (
              <p className="text-sm text-gray-500 mt-1">
                File should be placed in public/shared-files/
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
            >
              {saving ? 'Creating...' : 'Create Link'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/admin/links')}
              className="px-6 py-2 bg-gray-300 text-black rounded-md hover:bg-gray-400 font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
