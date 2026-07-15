'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/navigation/Header';
import ImagePlaceholder from '@/components/ImagePlaceholder';
import { trackEvent } from '@/lib/analytics';

interface Design {
  id: string;
  name: string;
  shortDescription: string | null;
  slug: string;
  hasPreviewImage: boolean;
  hasClinicalGuide: boolean;
  category: 'splint' | 'tool';
}

// Shared visual content (image, clinical-guide badge, title, description) for both the
// clickable <Link> splint cards and the button-driven tool cards below.
function DesignCardBody({
  design,
  onClinicalGuideClick,
}: {
  design: Design;
  onClinicalGuideClick: (e: React.MouseEvent) => void;
}) {
  return (
    <>
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
        {design.hasClinicalGuide && (
          <button
            type="button"
            title="Clinical Guide and User Instructions"
            aria-label={`Clinical Guide and User Instructions for ${design.name}`}
            className="clinical-guide-badge"
            data-testid="clinical-guide-icon"
            onClick={onClinicalGuideClick}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v.01a.75.75 0 001.5 0v-.01zM10 9a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 9z" clipRule="evenodd" />
            </svg>
          </button>
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
    </>
  );
}

export default function GeoJobMenuPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [geometries, setGeometries] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Tool cards trigger an async quick-run request instead of navigating via <Link>.
  const [runningToolId, setRunningToolId] = useState<string | null>(null);
  const [toolError, setToolError] = useState<string | null>(null);

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
      trackEvent('design_menu_loaded', {
        design_count: Array.isArray(data) ? data.length : 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load designs');
    } finally {
      setLoading(false);
    }
  };

  const openClinicalGuide = (design: Design, source: string) => (e: React.MouseEvent) => {
    // Stop the outer <Link>/card click from also selecting this design.
    e.preventDefault();
    e.stopPropagation();
    trackEvent('clinical_guide_opened', {
      source,
      design_id: design.id,
      design_slug: design.slug,
    });
    window.open(`/designs/${design.slug}/clinical-guide`, '_blank', 'noopener,noreferrer');
  };

  // Tool designs have no input form: jump straight to a print (existing completed job,
  // possibly cloned from another org) or to the processing page for the very first run.
  const handleToolClick = async (design: Design) => {
    if (runningToolId) return;
    setRunningToolId(design.id);
    setToolError(null);
    trackEvent('design_selected', {
      source: 'design_menu',
      design_id: design.id,
      design_slug: design.slug,
      category: 'tool',
    });
    try {
      const response = await fetch(`/api/designs/${design.id}/quick-run`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start tool job');
      }
      if (data.mode === 'print') {
        router.push(`/print-queue/${data.printJobId}`);
      } else {
        router.push(`/design-jobs/${data.designJobId}`);
      }
    } catch (err) {
      setToolError(err instanceof Error ? err.message : 'Failed to start tool job');
      setRunningToolId(null);
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

  const splintDesigns = geometries.filter(d => d.category !== 'tool');
  const toolDesigns = geometries.filter(d => d.category === 'tool');

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

        {toolError && (
          <div className="mb-6 alert-error" role="alert" data-testid="tool-quick-run-error">
            {toolError}
          </div>
        )}

        {geometries.length === 0 ? (
          <div className="text-center py-12" data-testid="design-menu-empty">
            <p className="text-muted">No splint designs available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="design-menu-grid">
            {splintDesigns.map((design) => (
              <Link
                key={design.id}
                href={`/design-jobs/new?designId=${design.id}`}
                className="design-card rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                data-testid="design-menu-card"
                data-design-id={design.id}
                onClick={() => {
                  trackEvent('design_selected', {
                    source: 'design_menu',
                    design_id: design.id,
                    design_slug: design.slug,
                  });
                }}
              >
                <DesignCardBody design={design} onClinicalGuideClick={openClinicalGuide(design, 'design_menu')} />
              </Link>
            ))}
          </div>
        )}

        {toolDesigns.length > 0 && (
          <div className="mt-12">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-primary">Tools</h2>
              <p className="mt-1 text-sm text-secondary">
                Fitting aids with no measurements to enter &mdash; select one to queue a print.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="design-menu-tools-grid">
              {toolDesigns.map((design) => {
                const isRunning = runningToolId === design.id;
                return (
                  <div
                    key={design.id}
                    role="button"
                    tabIndex={0}
                    aria-disabled={isRunning}
                    className="design-card rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden relative cursor-pointer"
                    data-testid="design-menu-tool-card"
                    data-design-id={design.id}
                    onClick={() => handleToolClick(design)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToolClick(design);
                      }
                    }}
                  >
                    <DesignCardBody design={design} onClinicalGuideClick={openClinicalGuide(design, 'design_menu_tools')} />
                    {isRunning && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-blue)]"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
