'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/navigation/Header';

interface NamedGeometry {
  id: string;
  GeometryName: string;
  GeometryAlgorithmName: string;
  GeometryInputParameterSchema: string;
}

interface GeometryInputParameter {
  InputName: string;
  InputDescription: string;
  InputType: 'Float' | 'Integer' | 'Text';
  NumberMin?: number;
  NumberMax?: number;
  TextMinLen?: number;
  TextMaxLen?: number;
}

export default function CreateGeometryJobPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [geometries, setGeometries] = useState<NamedGeometry[]>([]);
  const [selectedGeometry, setSelectedGeometry] = useState<NamedGeometry | null>(null);
  const [parameterSchema, setParameterSchema] = useState<GeometryInputParameter[]>([]);
  const [parameterValues, setParameterValues] = useState<Record<string, any>>({});
  const [customerNote, setCustomerNote] = useState('');
  const [customerID, setCustomerID] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
      const response = await fetch('/api/named-geometry');
      if (!response.ok) {
        throw new Error('Failed to fetch geometries');
      }
      const data = await response.json();
      setGeometries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch geometries');
    } finally {
      setLoading(false);
    }
  };

  const handleGeometryChange = (geometryId: string) => {
    const geometry = geometries.find(g => g.id === geometryId);
    setSelectedGeometry(geometry || null);
    
    if (geometry) {
      try {
        const schema: GeometryInputParameter[] = JSON.parse(geometry.GeometryInputParameterSchema);
        setParameterSchema(schema);
        
        // Initialize parameter values with defaults
        const initialValues: Record<string, any> = {};
        schema.forEach(param => {
          if (param.InputType === 'Float' || param.InputType === 'Integer') {
            initialValues[param.InputName] = param.NumberMin || 0;
          } else if (param.InputType === 'Text') {
            initialValues[param.InputName] = '';
          }
        });
        setParameterValues(initialValues);
      } catch (parseError) {
        setError('Failed to parse geometry parameter schema');
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
    
    if (!selectedGeometry) {
      setError('Please select a geometry');
      return;
    }
    
    if (!validateParameters()) {
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/geometry-jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          GeometryID: selectedGeometry.id,
          GeometryInputParameterData: JSON.stringify(parameterValues),
          CustomerNote: customerNote.trim() || null,
          CustomerID: customerID.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create geometry job');
      }

      router.push('/admin/geometry-jobs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create geometry job');
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
            <p className="mt-4 text-gray-600">Loading geometries...</p>
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
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create Geometry Job</h1>
              <p className="mt-2 text-gray-600">
                Create a new geometry processing job for your organization.
              </p>
            </div>
            <Link
              href="/admin/geometry-jobs"
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium"
            >
              ← Back to Jobs
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

        <div className="bg-white shadow rounded-lg">
          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
            <div>
              <label htmlFor="geometry" className="block text-sm font-medium text-gray-700">
                Geometry Type *
              </label>
              <select
                id="geometry"
                value={selectedGeometry?.id || ''}
                onChange={(e) => handleGeometryChange(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a geometry type</option>
                {geometries.map((geometry) => (
                  <option key={geometry.id} value={geometry.id}>
                    {geometry.GeometryName} ({geometry.GeometryAlgorithmName})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="customerID" className="block text-sm font-medium text-gray-700">
                  Customer ID
                </label>
                <input
                  type="text"
                  id="customerID"
                  value={customerID}
                  onChange={(e) => setCustomerID(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional customer identifier"
                />
              </div>
              
              <div>
                <label htmlFor="customerNote" className="block text-sm font-medium text-gray-700">
                  Customer Note
                </label>
                <input
                  type="text"
                  id="customerNote"
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional note about this job"
                />
              </div>
            </div>

            {selectedGeometry && parameterSchema.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Geometry Parameters for {selectedGeometry.GeometryName}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {parameterSchema.map((param) => (
                    <div key={param.InputName}>
                      <label htmlFor={param.InputName} className="block text-sm font-medium text-gray-700">
                        {param.InputDescription} *
                      </label>
                      {param.InputType === 'Float' ? (
                        <input
                          type="number"
                          step="any"
                          id={param.InputName}
                          value={parameterValues[param.InputName] || ''}
                          onChange={(e) => handleParameterChange(param.InputName, parseFloat(e.target.value) || 0)}
                          min={param.NumberMin}
                          max={param.NumberMax}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      ) : param.InputType === 'Integer' ? (
                        <input
                          type="number"
                          id={param.InputName}
                          value={parameterValues[param.InputName] || ''}
                          onChange={(e) => handleParameterChange(param.InputName, parseInt(e.target.value) || 0)}
                          min={param.NumberMin}
                          max={param.NumberMax}
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
                href="/admin/geometry-jobs"
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded text-sm font-medium"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting || !selectedGeometry}
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