'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/navigation/Header';
import ImagePlaceholder from '@/components/ImagePlaceholder';

interface NamedGeometry {
  id: string;
  GeometryName: string;
  shortDescription: string | null;
  previewImageUpdatedAt: string | null;
}

export default function GeoJobMenuPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [geometries, setGeometries] = useState<NamedGeometry[]>([]);
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
      const response = await fetch('/api/geometries?activeOnly=true');
      if (!response.ok) {
        throw new Error('Failed to fetch geometries');
      }
      const data = await response.json();
      setGeometries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load geometries');
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (geometryId: string, updatedAt: string | null) => {
    const baseUrl = `/api/geometry-images/${geometryId}/preview`;
    return updatedAt ? `${baseUrl}?v=${new Date(updatedAt).getTime()}` : baseUrl;
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header variant="browser" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading geometries...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header variant="browser" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header variant="browser" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create New Splint</h1>
          <p className="mt-2 text-gray-600">Select a splint design to get started</p>
        </div>

        {geometries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No splint designs available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {geometries.map((geometry) => (
              <Link
                key={geometry.id}
                href={`/admin/geometry-jobs/new?geometryId=${geometry.id}`}
                className="group bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-gray-200 hover:border-blue-300"
              >
                <div className="aspect-[4/3] relative bg-gray-100">
                  {geometry.previewImageUpdatedAt ? (
                    <Image
                      src={getImageUrl(geometry.id, geometry.previewImageUpdatedAt)}
                      alt={geometry.GeometryName}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <ImagePlaceholder className="w-full h-full" />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {geometry.GeometryName}
                  </h3>
                  {geometry.shortDescription && (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                      {geometry.shortDescription}
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
