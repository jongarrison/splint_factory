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
      <div className="page-shell flex items-center justify-center" data-testid="new-link-loading">
        <div className="text-lg text-secondary">Loading...</div>
      </div>
    );
  }

  if (!session?.user || session.user.role !== 'SYSTEM_ADMIN') {
    return null;
  }

  return (
    <div className="page-shell" data-testid="new-link-page">
      <Header />
      <div className="container mx-auto p-6 max-w-2xl">
        <h1 className="page-title mb-6">Create New Link</h1>

        {error && (
          <div className="alert-error mb-4" data-testid="alert-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card p-6 space-y-6">
          {/* Shortcode */}
          <div>
            <label htmlFor="shortcode" className="block text-sm font-semibold text-secondary mb-2">
              Shortcode <span className="text-[var(--status-error-text)]">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="shortcode"
                value={shortcode}
                onChange={(e) => setShortcode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                required
                pattern="[a-z0-9]+"
                className="input-field flex-1"
                data-testid="shortcode-input"
                placeholder="abc123"
              />
              <button
                type="button"
                onClick={() => setShortcode(generateShortcode())}
                className="btn-neutral px-4 py-2"
                data-testid="generate-shortcode-btn"
              >
                Generate
              </button>
            </div>
            <p className="text-sm text-muted mt-1">
              Your link will be: {window.location.origin}/l/{shortcode || '...'}
            </p>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-semibold text-secondary mb-2">
              Title (optional)
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
              data-testid="title-input"
              placeholder="Internal reference name"
            />
          </div>

          {/* Link Type */}
          <div>
            <label className="block text-sm font-semibold text-secondary mb-2">
              Link Type <span className="text-[var(--status-error-text)]">*</span>
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
            <label htmlFor="linkTarget" className="block text-sm font-semibold text-secondary mb-2">
              {linkType === 'EXTERNAL_URL' ? 'Target URL' : 'Filename'} <span className="text-[var(--status-error-text)]">*</span>
            </label>
            <input
              type="text"
              id="linkTarget"
              value={linkTarget}
              onChange={(e) => setLinkTarget(e.target.value)}
              required
              className="input-field"
              data-testid="link-target-input"
              placeholder={
                linkType === 'EXTERNAL_URL' 
                  ? 'https://example.com' 
                  : 'document.pdf'
              }
            />
            {linkType === 'HOSTED_FILE' && (
              <p className="text-sm text-muted mt-1">
                File should be placed in public/shared-files/
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary px-6 py-2"
              data-testid="submit-btn"
            >
              {saving ? 'Creating...' : 'Create Link'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/admin/links')}
              className="btn-neutral px-6 py-2"
              data-testid="cancel-btn"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
