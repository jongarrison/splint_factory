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
  slug: string;
  inputParameters: InputParameter[];
  hasMeasurementImage: boolean;
}

interface InputParameter {
  InputName: string;
  InputDescription: string;
  InputType: 'Float' | 'Integer' | 'Text' | 'Boolean';
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
        setParameterSchema(design.inputParameters);
        
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
      const response = await fetch('/api/designs?includeSchema=true');
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
      const schema = design.inputParameters;
      setParameterSchema(schema);
      
      // Initialize parameter values as empty (no defaults)
      const initialValues: Record<string, any> = {};
      schema.forEach(param => {
        initialValues[param.InputName] = param.InputType === 'Boolean' ? false : '';
        });
        setParameterValues(initialValues);
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
      
      if (param.InputType === 'Boolean') {
        // Booleans are always valid (false is a valid value)
        continue;
      }

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
      <div className="page-shell" data-testid="new-design-job-loading">
        <Header />
        <div className="page-content">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-blue)] mx-auto"></div>
            <p className="mt-4 text-secondary">Loading designs...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell" data-testid="new-design-job-page">
      <Header />
      
      <div className="page-content">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="page-title">
              {selectedDesign ? `New ${selectedDesign.name} Job` : 'Create New Print'}
            </h1>
            <Link
              href="/design-menu"
              className="btn-neutral px-4 py-2 text-sm"
              data-testid="back-btn"
            >
              &larr; Back to Designs
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 alert-error" data-testid="new-design-job-error">
            {error}
            <button 
              onClick={() => setError(null)}
              className="ml-2 text-error"
              data-testid="dismiss-error-btn"
            >
              &#x2715;
            </button>
          </div>
        )}

        {/* Measurement Helper Image */}
        {selectedDesign && (
          <div className="mb-6 card shadow" data-testid="measurement-guide-card">
            <div className="card-body">
              <h2 className="text-lg font-medium text-primary mb-4">Measurement Guide</h2>
              <div className="flex justify-center">
                <div className="relative w-full max-w-3xl">
                  {selectedDesign.hasMeasurementImage ? (
                    <Image
                      src={`/designs/${selectedDesign.slug}/measurement.png`}
                      alt={`${selectedDesign.name} measurement guide`}
                      width={800}
                      height={600}
                      className="rounded-lg"
                      style={{ width: '100%', height: 'auto' }}
                      unoptimized
                    />
                  ) : (
                    <div className="w-full aspect-[4/3] bg-[var(--surface-secondary)] rounded-lg flex items-center justify-center border-2 border-dashed border-[var(--border)]">
                      <div className="text-center p-8">
                        <svg 
                          className="mx-auto h-16 w-16 text-[var(--text-muted)] mb-4" 
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
                        <p className="text-secondary text-sm">No measurement guide available</p>
                        <p className="text-muted text-xs mt-1">Contact administrator to add measurement image</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="card shadow" data-testid="new-design-job-form-card">
          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
            {/* Design type shown as read-only info (pre-selected via URL) */}
            {selectedDesign && (
              <div>
                <label className="block text-sm font-medium text-secondary">Design Type</label>
                <p className="mt-1 text-sm text-primary font-medium">
                  {selectedDesign.name} ({selectedDesign.algorithmName})
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="jobLabel" className="block text-sm font-medium text-secondary" title="Short label that will show in the print queue. Do not include patient data.">
                  Job Label
                </label>
                <input
                  type="text"
                  id="jobLabel"
                  value={jobLabel}
                  onChange={(e) => setJobLabel(e.target.value)}
                  className="mt-1 input-field"
                  placeholder="Optional label for this job"
                  data-testid="job-label-input"
                />
              </div>
              
              <div>
                <label htmlFor="jobNote" className="block text-sm font-medium text-secondary" title="Do not include patient data.">
                  Job Note
                </label>
                <input
                  type="text"
                  id="jobNote"
                  value={jobNote}
                  onChange={(e) => setJobNote(e.target.value)}
                  className="mt-1 input-field"
                  placeholder="Optional note about this job"
                  data-testid="job-note-input"
                />
              </div>
            </div>

            {selectedDesign && parameterSchema.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-primary mb-4">
                  Design Parameters for {selectedDesign.name}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {parameterSchema.map((param) => (
                    <div key={param.InputName}>
                      {param.InputType !== 'Boolean' && (
                        <label htmlFor={param.InputName} className="block text-sm font-medium text-secondary">
                          {param.InputDescription} *
                        </label>
                      )}
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
                          className="mt-1 input-field"
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
                          className="mt-1 input-field"
                          required
                        />
                      ) : param.InputType === 'Boolean' ? (
                        <label htmlFor={param.InputName} className="mt-2 inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            id={param.InputName}
                            checked={!!parameterValues[param.InputName]}
                            onChange={(e) => handleParameterChange(param.InputName, e.target.checked)}
                            className="h-5 w-5 rounded border-[var(--border)] accent-[var(--accent-blue)]"
                          />
                          <span className="text-sm text-secondary">{param.InputDescription}</span>
                        </label>
                      ) : (
                        <input
                          type="text"
                          id={param.InputName}
                          value={parameterValues[param.InputName] || ''}
                          onChange={(e) => handleParameterChange(param.InputName, e.target.value)}
                          minLength={param.TextMinLen}
                          maxLength={param.TextMaxLen}
                          className="mt-1 input-field"
                          required
                        />
                      )}
                      {(param.InputType === 'Float' || param.InputType === 'Integer') && (
                        <p className="mt-1 text-xs text-muted">
                          {param.NumberMin !== undefined && param.NumberMax !== undefined
                            ? `Range: ${param.NumberMin} - ${param.NumberMax}`
                            : param.NumberMin !== undefined
                            ? `Minimum: ${param.NumberMin}`
                            : param.NumberMax !== undefined
                            ? `Maximum: ${param.NumberMax}`
                            : ''}
                        </p>
                      )}
                      {param.InputType === 'Text' && (
                        <p className="mt-1 text-xs text-muted">
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

            <div className="flex justify-end gap-4 pt-4 border-t border-[var(--border)]">
              <Link
                href="/design-menu"
                className="btn-neutral px-4 py-2 text-sm"
                data-testid="cancel-btn"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting || !selectedDesign}
                className="btn-primary px-4 py-2 text-sm"
                data-testid="submit-btn"
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
      <div className="page-shell flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-blue)] mx-auto"></div>
          <p className="mt-2 text-sm text-secondary">Loading...</p>
        </div>
      </div>
    }>
      <CreateGeometryJobPage />
    </Suspense>
  );
}