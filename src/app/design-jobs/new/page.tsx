'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/navigation/Header';
import ValidationSummary from '@/components/forms/ValidationSummary';
import { useFormValidation, fieldErrorClass, type FieldErrors } from '@/lib/formValidation';
import { getDesignHintsFn } from '@/designs/hints-registry';
import { getDesignCustomForm } from '@/designs/custom-form-registry';
import type { DesignHint } from '@/designs/types';
import { trackEvent } from '@/lib/analytics';

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
  const [jobLabel, setJobLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeHints, setActiveHints] = useState<DesignHint[]>([]);
  // Validity reported by a design's bespoke form (only used when one is rendered).
  const [customFormValid, setCustomFormValid] = useState(false);
  const hasTrackedFormOpenRef = useRef(false);
  // Scroll target for failed-submit feedback — top of the form card,
  // so the summary alert lands well within view on mobile.
  const formCardRef = useRef<HTMLDivElement | null>(null);
  const validation = useFormValidation({ scrollTargetRef: formCardRef });

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

    // Extend the geo processor's keep-warm lease so Rhino is hot by the time
    // the user submits. Fire-and-forget; failures don't block the page.
    fetch('/api/design-processing/keep-warm', { method: 'POST' }).catch(() => {});

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

  useEffect(() => {
    if (hasTrackedFormOpenRef.current) return;
    if (status !== 'authenticated') return;

    hasTrackedFormOpenRef.current = true;
    trackEvent('design_job_form_viewed', {
      has_design_id: Boolean(designId),
      from_template: Boolean(templateId),
    });
  }, [status, designId, templateId]);

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

  // Evaluate hints against the given values and update state.
  // Pass merged values directly to avoid waiting on async state updates.
  const evaluateHints = (designId: string, values: Record<string, any>) => {
    const hintsFn = getDesignHintsFn(designId);
    setActiveHints(hintsFn ? hintsFn(values) : []);
  };

  const handleGeometryChange = (geometryId: string) => {
    const design = geometries.find(g => g.id === geometryId);
    setSelectedDesign(design || null);
    setActiveHints([]);
    setCustomFormValid(false);
    
    if (design) {
      trackEvent('design_selected', {
        source: 'design_job_form',
        design_id: design.id,
        design_slug: design.slug,
      });

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

  // Clear only the edited field's error so other invalid fields stay highlighted.
  const handleParameterChange = (paramName: string, value: any) => {
    validation.clearError(paramName);
    setParameterValues(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  // Build a map of all parameter errors at once (first error per field wins).
  // Returning the full map lets the validation hook scroll/highlight everything
  // that needs attention rather than only the first failure.
  const collectParameterErrors = (): FieldErrors => {
    const errors: FieldErrors = {};
    for (const param of parameterSchema) {
      const value = parameterValues[param.InputName];
      const label = param.InputDescription || param.InputName;

      if (param.InputType === 'Boolean') continue; // false is a valid value

      if (value === undefined || value === null || value === '') {
        errors[param.InputName] = `${label} is required`;
        continue;
      }

      if (param.InputType === 'Float' || param.InputType === 'Integer') {
        const numValue = param.InputType === 'Float' ? parseFloat(value) : parseInt(value);
        const isInt = param.InputType === 'Integer' && Number.isInteger(parseFloat(value));
        if (isNaN(numValue) || (param.InputType === 'Integer' && !isInt)) {
          errors[param.InputName] = `${label} must be a valid ${param.InputType === 'Integer' ? 'integer' : 'number'}`;
          continue;
        }
        if (param.NumberMin !== undefined && numValue < param.NumberMin) {
          errors[param.InputName] = `${label} must be >= ${param.NumberMin}`;
          continue;
        }
        if (param.NumberMax !== undefined && numValue > param.NumberMax) {
          errors[param.InputName] = `${label} must be <= ${param.NumberMax}`;
          continue;
        }
      } else if (param.InputType === 'Text') {
        const strValue = String(value);
        if (param.TextMinLen !== undefined && strValue.length < param.TextMinLen) {
          errors[param.InputName] = `${label} must be at least ${param.TextMinLen} characters`;
          continue;
        }
        if (param.TextMaxLen !== undefined && strValue.length > param.TextMaxLen) {
          errors[param.InputName] = `${label} must be no more than ${param.TextMaxLen} characters`;
          continue;
        }
      }
    }
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Build a single error map covering design selection + every parameter,
    // then hand it to the validation hook which sets state and scrolls on failure.
    const isValid = validation.runValidation(() => {
      const errors: FieldErrors = {};
      if (!selectedDesign) {
        errors.__design = 'Please select a design';
        return errors;
      }
      return collectParameterErrors();
    });
    if (!isValid || !selectedDesign) return;

    // Designs with a bespoke form validate themselves; block submit until they report valid.
    const customForm = getDesignCustomForm(selectedDesign.id);
    if (customForm && !customFormValid) {
      setError('Please complete the required fields before submitting.');
      return;
    }

    trackEvent('design_job_create_submitted', {
      design_id: selectedDesign.id,
      parameter_count: parameterSchema.length,
      has_job_label: jobLabel.trim().length > 0,
    });
    
    setSubmitting(true);
    setError(null);

    let responseStatus = 0;
    
    try {
      const response = await fetch('/api/design-jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          designId: selectedDesign.id,
          inputParameters: JSON.stringify(parameterValues),
          jobLabel: jobLabel.trim() || null,
        }),
      });

      responseStatus = response.status;

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create design job');
      }

      const createdJob = await response.json();
      trackEvent('design_job_created', {
        design_id: selectedDesign.id,
        has_job_id: Boolean(createdJob?.id),
      });
      
      // Navigate to job details page to track progress
      router.push(`/design-jobs/${createdJob.id}`);
      
    } catch (err) {
      trackEvent('design_job_create_failed', {
        design_id: selectedDesign.id,
        status_code: responseStatus,
      });
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

  // Bespoke form for designs whose parameters do not fit the flat scalar schema.
  const CustomFormComp = selectedDesign ? getDesignCustomForm(selectedDesign.id) : undefined;

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

        <div ref={formCardRef} className="card shadow" data-testid="new-design-job-form-card">
          <form onSubmit={handleSubmit} noValidate className="px-6 py-4 space-y-6">
            <ValidationSummary
              errors={validation.errors}
              summaryRef={validation.summaryRef}
              testId="new-design-job-validation-error"
            />

            {/* Design type shown as read-only info (pre-selected via URL) */}
            {selectedDesign && (
              <div>
                <label className="block text-sm font-medium text-secondary">Design Type</label>
                <p className="mt-1 text-sm text-primary font-medium">
                  {selectedDesign.name}
                </p>
              </div>
            )}

            <div>
              <label htmlFor="jobLabel" className="block text-sm font-medium text-secondary" title="Short label that will show in the print queue. Do not include patient data.">
                Print Queue Label (No PII)
              </label>
              <input
                type="text"
                id="jobLabel"
                value={jobLabel}
                onChange={(e) => setJobLabel(e.target.value)}
                maxLength={20}
                className="mt-1 input-field"
                placeholder="Optional label shown in the print queue"
                data-testid="job-label-input"
              />
            </div>

            {selectedDesign && CustomFormComp && (
              <CustomFormComp
                value={parameterValues}
                onChange={setParameterValues}
                onValidChange={setCustomFormValid}
              />
            )}

            {selectedDesign && !CustomFormComp && parameterSchema.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-primary mb-4">
                  Design Parameters for {selectedDesign.name}
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {parameterSchema.map((param) => {
                    const fieldError = validation.errors[param.InputName];
                    const errClass = fieldErrorClass(fieldError);
                    return (
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
                            const numVal = parseFloat(val);
                            if (val !== '' && !isNaN(numVal)) {
                              handleParameterChange(param.InputName, numVal);
                            }
                            if (selectedDesign) {
                              evaluateHints(selectedDesign.id, { ...parameterValues, [param.InputName]: !isNaN(numVal) ? numVal : val });
                            }
                          }}
                          className={`mt-1 input-field ${errClass}`}
                          aria-invalid={!!fieldError}
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
                            const numVal = parseInt(val);
                            if (val !== '' && !isNaN(numVal)) {
                              handleParameterChange(param.InputName, numVal);
                            }
                            if (selectedDesign) {
                              evaluateHints(selectedDesign.id, { ...parameterValues, [param.InputName]: !isNaN(numVal) ? numVal : val });
                            }
                          }}
                          className={`mt-1 input-field ${errClass}`}
                          aria-invalid={!!fieldError}
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
                          className={`mt-1 input-field ${errClass}`}
                          aria-invalid={!!fieldError}
                        />
                      )}
                      {fieldError && (
                        <p className="mt-1 text-xs text-[var(--accent-red)]" data-testid={`field-error-${param.InputName}`}>
                          {fieldError}
                        </p>
                      )}
                      {activeHints
                        .filter(h => h.targetParameter === param.InputName)
                        .map((hint, i) => (
                          <p key={i} className="mt-1 text-xs text-[var(--accent-yellow)]" data-testid={`hint-${param.InputName}`}>
                            {hint.message}
                          </p>
                        ))}
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
                    );
                  })}
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
                disabled={submitting || !selectedDesign || (!!CustomFormComp && !customFormValid)}
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