'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/navigation/Header';
import ImagePlaceholder from '@/components/ImagePlaceholder';

interface Design {
  id: string;
  name: string;
  shortDescription: string | null;
  slug: string;
  hasPreviewImage: boolean;
}

export default function GeoJobMenuPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [geometries, setGeometries] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user) {
      router.push('/login');
      return;
    }

    fetchGeometries();
  }, [session, status, router]);

  const fetchGeometries = async () => {
    try {
      const response = await fetch('/api/designs?activeOnly=true');
      if (!response.ok) {
        throw new Error('Failed to fetch designs');
      }
      const data = await response.json();
      setGeometries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load designs');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="page-shell">
        <Header variant="browser" />
        <div className="page-content">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-blue)] mx-auto"></div>
            <p className="mt-4 text-secondary">Loading designs...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-shell">
        <Header variant="browser" />
        <div className="page-content" data-testid="design-menu-page">
          <div className="alert-error" role="alert">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell" data-testid="design-menu-page">
      <Header variant="browser" />

      <div className="page-content">
        <div className="mb-8">
          <h1 className="page-title">Create New 3D Print</h1>
          <p className="mt-2 text-secondary">
            Select a splint design to get started{' '}
            <Link href="/design-jobs" className="text-link underline">
              or start from a previous job
            </Link>
          </p>
        </div>

        {geometries.length === 0 ? (
          <div className="text-center py-12" data-testid="design-menu-empty">
            <p className="text-muted">No splint designs available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="design-menu-grid">
            {geometries.map((design) => (
              <Link
                key={design.id}
                href={`/design-jobs/new?designId=${design.id}`}
                className="design-card rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                data-testid="design-menu-card"
                data-design-id={design.id}
              >
                <div className="aspect-[4/3] relative bg-surface-secondary">
                  {design.hasPreviewImage ? (
                    <Image
                      src={`/designs/${design.slug}/preview.png`}
                      alt={design.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <ImagePlaceholder className="w-full h-full" />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="design-card-title transition-colors">
                    {design.name}
                  </h3>
                  {design.shortDescription && (
                    <p className="mt-2 text-sm text-secondary line-clamp-2">
                      {design.shortDescription}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
