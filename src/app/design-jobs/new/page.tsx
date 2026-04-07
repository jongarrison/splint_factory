'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/navigation/Header';

interface Design {
  id: string;
  name: string;
  algorithmName: string;
  inputParameterSchema: string;
  measurementImageUpdatedAt?: string | null;
}

interface InputParameter {
  InputName: string;
  InputDescription: string;
  InputType: 'Float' | 'Integer' | 'Text';
  NumberMin?: number;
  NumberMax?: number;
  TextMinLen?: number;
  TextMaxLen?: number;
}

function CreateGeometryJobPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('template');
  const designId = searchParams.get('designId');
  
  const [geometries, setGeometries] = useState<Design[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<Design | null>(null);
  const [parameterSchema, setParameterSchema] = useState<InputParameter[]>([]);
  const [parameterValues, setParameterValues] = useState<Record<string, any>>({});
  const [jobNote, setJobNote] = useState('');
  const [jobLabel, setJobLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user) {
      router.push('/login');
      return;
    }

    // designId or template is required (comes from design-menu); redirect if missing
    if (!designId && !templateId) {
      router.push('/design-menu');
      return;
    }

    fetchGeometries();
  }, [session, status, router, designId, templateId]);

  // Load template job if template param is present
  useEffect(() => {
    if (templateId && geometries.length > 0 && !selectedDesign) {
      loadTemplateJob(templateId);
    }
  }, [templateId, geometries]);

  // Pre-select design if designId param is present
  useEffect(() => {
    if (designId && geometries.length > 0 && !selectedDesign) {
      handleGeometryChange(designId);
    }
  }, [designId, geometries]);

  const loadTemplateJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/design-jobs/${jobId}`);
      if (!response.ok) throw new Error('Failed to fetch template job');
      
      const templateJob = await response.json();
      const design = geometries.find(g => g.id === templateJob.designId);
      
      if (design) {
        setSelectedDesign(design);
        const schema: InputParameter[] = JSON.parse(design.inputParameterSchema);
        setParameterSchema(schema);
        
        // Parse and set parameter values from template
        const templateParams = JSON.parse(templateJob.inputParameters);
        setParameterValues(templateParams);
        
        // Optionally copy job info (leave blank for new job)
        // setJobID(templateJob.jobLabel || '');
        // setJobNote(templateJob.jobNote || '');
      }
    } catch (err) {
      console.error('Failed to load template job:', err);
      // Don't show error to user, just fail silently and let them create from scratch
    }
  };

  const fetchGeometries = async () => {
    try {
      const response = await fetch('/api/admin/design-definitions');
      if (!response.ok) {
        throw new Error('Failed to fetch designs');
      }
      const data = await response.json();
      setGeometries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch designs');
    } finally {
      setLoading(false);
    }
  };

  const handleGeometryChange = (geometryId: string) => {
    const design = geometries.find(g => g.id === geometryId);
    setSelectedDesign(design || null);
    
    if (design) {
      try {
        const schema: InputParameter[] = JSON.parse(design.inputParameterSchema);
        setParameterSchema(schema);
        
        // Initialize parameter values as empty (no defaults)
        const initialValues: Record<string, any> = {};
        schema.forEach(param => {
          initialValues[param.InputName] = '';
        });
        setParameterValues(initialValues);
      } catch (parseError) {
        setError('Failed to parse design parameter schema');
        setParameterSchema([]);
        setParameterValues({});
      }
    } else {
      setParameterSchema([]);
      setParameterValues({});
    }
  };

  const handleParameterChange = (paramName: string, value: any) => {
    setParameterValues(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  const validateParameters = (): boolean => {
    for (const param of parameterSchema) {
      const value = parameterValues[param.InputName];
      
      if (value === undefined || value === null || value === '') {
        setError(`Parameter "${param.InputName}" is required`);
        return false;
      }
      
      if (param.InputType === 'Float') {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          setError(`Parameter "${param.InputName}" must be a valid number`);
          return false;
        }
        if (param.NumberMin !== undefined && numValue < param.NumberMin) {
          setError(`Parameter "${param.InputName}" must be >= ${param.NumberMin}`);
          return false;
        }
        if (param.NumberMax !== undefined && numValue > param.NumberMax) {
          setError(`Parameter "${param.InputName}" must be <= ${param.NumberMax}`);
          return false;
        }
      } else if (param.InputType === 'Integer') {
        const numValue = parseInt(value);
        if (isNaN(numValue) || !Number.isInteger(parseFloat(value))) {
          setError(`Parameter "${param.InputName}" must be a valid integer`);
          return false;
        }
        if (param.NumberMin !== undefined && numValue < param.NumberMin) {
          setError(`Parameter "${param.InputName}" must be >= ${param.NumberMin}`);
          return false;
        }
        if (param.NumberMax !== undefined && numValue > param.NumberMax) {
          setError(`Parameter "${param.InputName}" must be <= ${param.NumberMax}`);
          return false;
        }
      } else if (param.InputType === 'Text') {
        const strValue = String(value);
        if (param.TextMinLen !== undefined && strValue.length < param.TextMinLen) {
          setError(`Parameter "${param.InputName}" must be at least ${param.TextMinLen} characters`);
          return false;
        }
        if (param.TextMaxLen !== undefined && strValue.length > param.TextMaxLen) {
          setError(`Parameter "${param.InputName}" must be no more than ${param.TextMaxLen} characters`);
          return false;
        }
      }
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDesign) {
      setError('Please select a design');
      return;
    }
    
    if (!validateParameters()) {
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/design-jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          designId: selectedDesign.id,
          inputParameters: JSON.stringify(parameterValues),
          jobNote: jobNote.trim() || null,
          jobLabel: jobLabel.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create design job');
      }

      const createdJob = await response.json();
      
      // Navigate to job details page to track progress
      router.push(`/design-jobs/${createdJob.id}`);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create design job');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading designs...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">
              {selectedDesign ? `New ${selectedDesign.name} Job` : 'Create New Print'}
            </h1>
            <Link
              href="/design-menu"
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium"
            >
              &larr; Back to Designs
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
            <button 
              onClick={() => setError(null)}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* Measurement Helper Image */}
        {selectedDesign && (
          <div className="mb-6 bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Measurement Guide</h2>
            <div className="flex justify-center">
              <div className="relative w-full max-w-3xl">
                {selectedDesign.measurementImageUpdatedAt ? (
                  <Image
                    src={`/api/design-images/${selectedDesign.id}/measurement`}
                    alt={`${selectedDesign.name} measurement guide`}
                    width={800}
                    height={600}
                    className="rounded-lg"
                    style={{ width: '100%', height: 'auto' }}
                    unoptimized
                  />
                ) : (
                  <div className="w-full aspect-[4/3] bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                    <div className="text-center p-8">
                      <svg 
                        className="mx-auto h-16 w-16 text-gray-400 mb-4" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={1.5} 
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
                        />
                      </svg>
                      <p className="text-gray-500 text-sm">No measurement guide available</p>
                      <p className="text-gray-400 text-xs mt-1">Contact administrator to add measurement image</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow rounded-lg">
          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
            {/* Design type shown as read-only info (pre-selected via URL) */}
            {selectedDesign && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Design Type</label>
                <p className="mt-1 text-sm text-gray-900 font-medium">
                  {selectedDesign.name} ({selectedDesign.algorithmName})
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="jobLabel" className="block text-sm font-medium text-gray-700" title="Short label that will show in the print queue. Do not include patient data.">
                  Job Label
                </label>
                <input
                  type="text"
                  id="jobLabel"
                  value={jobLabel}
                  onChange={(e) => setJobLabel(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional label for this job"
                />
              </div>
              
              <div>
                <label htmlFor="jobNote" className="block text-sm font-medium text-gray-700" title="Do not include patient data.">
                  Job Note
                </label>
                <input
                  type="text"
                  id="jobNote"
                  value={jobNote}
                  onChange={(e) => setJobNote(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional note about this job"
                />
              </div>
            </div>

            {selectedDesign && parameterSchema.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Design Parameters for {selectedDesign.name}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {parameterSchema.map((param) => (
                    <div key={param.InputName}>
                      <label htmlFor={param.InputName} className="block text-sm font-medium text-gray-700">
                        {param.InputDescription} *
                      </label>
                      {param.InputType === 'Float' ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          id={param.InputName}
                          value={parameterValues[param.InputName] ?? ''}
                          onChange={(e) => handleParameterChange(param.InputName, e.target.value)}
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (val !== '' && !isNaN(parseFloat(val))) {
                              handleParameterChange(param.InputName, parseFloat(val));
                            }
                          }}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      ) : param.InputType === 'Integer' ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          id={param.InputName}
                          value={parameterValues[param.InputName] ?? ''}
                          onChange={(e) => handleParameterChange(param.InputName, e.target.value)}
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (val !== '' && !isNaN(parseInt(val))) {
                              handleParameterChange(param.InputName, parseInt(val));
                            }
                          }}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      ) : (
                        <input
                          type="text"
                          id={param.InputName}
                          value={parameterValues[param.InputName] || ''}
                          onChange={(e) => handleParameterChange(param.InputName, e.target.value)}
                          minLength={param.TextMinLen}
                          maxLength={param.TextMaxLen}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      )}
                      {param.InputType === 'Float' || param.InputType === 'Integer' ? (
                        <p className="mt-1 text-xs text-gray-500">
                          {param.NumberMin !== undefined && param.NumberMax !== undefined
                            ? `Range: ${param.NumberMin} - ${param.NumberMax}`
                            : param.NumberMin !== undefined
                            ? `Minimum: ${param.NumberMin}`
                            : param.NumberMax !== undefined
                            ? `Maximum: ${param.NumberMax}`
                            : ''}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-gray-500">
                          {param.TextMinLen !== undefined && param.TextMaxLen !== undefined
                            ? `Length: ${param.TextMinLen} - ${param.TextMaxLen} characters`
                            : param.TextMinLen !== undefined
                            ? `Minimum: ${param.TextMinLen} characters`
                            : param.TextMaxLen !== undefined
                            ? `Maximum: ${param.TextMaxLen} characters`
                            : ''}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-4 pt-4 border-t">
              <Link
                href="/design-menu"
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting || !selectedDesign}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm font-medium"
              >
                {submitting ? 'Creating Job...' : 'Create Job'}
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  );
}

// Wrap the page component in Suspense to handle useSearchParams
export default function CreateGeometryJobPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <CreateGeometryJobPage />
    </Suspense>
  );
}