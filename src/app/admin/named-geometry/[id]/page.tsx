'use client';

import { useState, useEffect, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { GeometryInputParameter, InputType } from '@/types/geometry-input-parameter';
import Header from '@/components/navigation/Header';

interface FormData {
  GeometryName: string;
  GeometryAlgorithmName: string;
  parameters: GeometryInputParameter[];
}

export default function EditNamedGeometryPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const resolvedParams = use(params);
  const [formData, setFormData] = useState<FormData>({
    GeometryName: '',
    GeometryAlgorithmName: '',
    parameters: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isNew = resolvedParams.id === 'new';

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user) {
      router.push('/login');
      return;
    }

    // Check if user is SYSTEM_ADMIN
    const user = session.user as any;
    if (user.role !== 'SYSTEM_ADMIN') {
      router.push('/');
      return;
    }

    if (!isNew) {
      fetchGeometry();
    }
  }, [session, status, router, isNew, resolvedParams.id]);

  const fetchGeometry = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/named-geometry/${resolvedParams.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch geometry');
      }
      const data = await response.json();
      
      const parsedSchema = JSON.parse(data.GeometryInputParameterSchema);
      
      setFormData({
        GeometryName: data.GeometryName,
        GeometryAlgorithmName: data.GeometryAlgorithmName,
        parameters: parsedSchema
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const addParameter = () => {
    setFormData(prev => ({
      ...prev,
      parameters: [
        ...prev.parameters,
        {
          InputName: '',
          InputDescription: '',
          InputType: 'Text' as InputType,
          TextMinLen: 1,
          TextMaxLen: 100
        } as GeometryInputParameter
      ]
    }));
  };

  const removeParameter = (index: number) => {
    setFormData(prev => ({
      ...prev,
      parameters: prev.parameters.filter((_, i) => i !== index)
    }));
  };

  const updateParameter = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      parameters: prev.parameters.map((param, i) => {
        if (i !== index) return param;
        
        const updated = { ...param, [field]: value };
        
        // Handle type changes - reset type-specific fields
        if (field === 'InputType') {
          if (value === 'Text') {
            return {
              InputName: updated.InputName,
              InputDescription: updated.InputDescription,
              InputType: 'Text' as const,
              TextMinLen: 1,
              TextMaxLen: 100
            };
          } else {
            return {
              InputName: updated.InputName,
              InputDescription: updated.InputDescription,
              InputType: value as 'Float' | 'Integer',
              NumberMin: 0,
              NumberMax: 100
            };
          }
        }
        
        return updated;
      })
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.GeometryName.trim()) {
      setError('Geometry Name is required');
      return false;
    }
    
    if (!formData.GeometryAlgorithmName.trim()) {
      setError('Geometry Algorithm Name is required');
      return false;
    }
    
    if (formData.GeometryAlgorithmName.includes(' ')) {
      setError('Geometry Algorithm Name cannot contain spaces');
      return false;
    }
    
    // Validate parameters
    for (let i = 0; i < formData.parameters.length; i++) {
      const param = formData.parameters[i];
      
      if (!param.InputName.trim()) {
        setError(`Parameter ${i + 1}: Input Name is required`);
        return false;
      }
      
      if (!/^[a-z0-9]+$/.test(param.InputName)) {
        setError(`Parameter ${i + 1}: Input Name must contain only lowercase letters and numbers`);
        return false;
      }
      
      if (!param.InputDescription.trim()) {
        setError(`Parameter ${i + 1}: Input Description is required`);
        return false;
      }
      
      if (param.InputType === 'Text') {
        const textParam = param as any;
        if (textParam.TextMaxLen < textParam.TextMinLen) {
          setError(`Parameter ${i + 1}: Text Max Length must be >= Text Min Length`);
          return false;
        }
      } else {
        const numParam = param as any;
        if (numParam.NumberMin !== undefined && numParam.NumberMax !== undefined) {
          if (numParam.NumberMax < numParam.NumberMin) {
            setError(`Parameter ${i + 1}: Number Max must be >= Number Min`);
            return false;
          }
        }
      }
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setLoading(true);
      
      const payload = {
        GeometryName: formData.GeometryName.trim(),
        GeometryAlgorithmName: formData.GeometryAlgorithmName.trim(),
        GeometryInputParameterSchema: JSON.stringify(formData.parameters)
      };
      
      const url = isNew ? '/api/named-geometry' : `/api/named-geometry/${resolvedParams.id}`;
      const method = isNew ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save geometry');
      }
      
      setSuccess(isNew ? 'Geometry created successfully!' : 'Geometry updated successfully!');
      
      if (isNew) {
        // Redirect to list after creating
        setTimeout(() => router.push('/admin/named-geometry'), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !isNew) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center">Loading...</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {isNew ? 'Create New Named Geometry' : 'Edit Named Geometry'}
        </h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Geometry Name
                </label>
                <input
                  type="text"
                  value={formData.GeometryName}
                  onChange={(e) => setFormData(prev => ({ ...prev, GeometryName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={250}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Algorithm Name (no spaces)
                </label>
                <input
                  type="text"
                  value={formData.GeometryAlgorithmName}
                  onChange={(e) => setFormData(prev => ({ ...prev, GeometryAlgorithmName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={250}
                  pattern="[^\s]+"
                  required
                />
              </div>
            </div>
          </div>
          
          <div className="bg-white shadow-md rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">Input Parameters</h2>
              <button
                type="button"
                onClick={addParameter}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-sm"
              >
                Add Parameter
              </button>
            </div>
            
            {formData.parameters.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No parameters defined</p>
            ) : (
              <div className="space-y-4">
                {formData.parameters.map((param, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-sm font-medium text-gray-700">Parameter {index + 1}</h3>
                      <button
                        type="button"
                        onClick={() => removeParameter(index)}
                        className="text-red-600 hover:text-red-500 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Input Name (a-z, 0-9 only)
                        </label>
                        <input
                          type="text"
                          value={param.InputName}
                          onChange={(e) => updateParameter(index, 'InputName', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          pattern="[a-z0-9]+"
                          maxLength={50}
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Type
                        </label>
                        <select
                          value={param.InputType}
                          onChange={(e) => updateParameter(index, 'InputType', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="Text">Text</option>
                          <option value="Integer">Integer</option>
                          <option value="Float">Float</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Description
                      </label>
                      <textarea
                        value={param.InputDescription}
                        onChange={(e) => updateParameter(index, 'InputDescription', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        maxLength={250}
                        rows={2}
                        required
                      />
                    </div>
                    
                    {param.InputType === 'Text' ? (
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Min Length
                          </label>
                          <input
                            type="number"
                            value={(param as any).TextMinLen || 0}
                            onChange={(e) => updateParameter(index, 'TextMinLen', parseInt(e.target.value))}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            min="0"
                            max="250"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Max Length
                          </label>
                          <input
                            type="number"
                            value={(param as any).TextMaxLen || 1}
                            onChange={(e) => updateParameter(index, 'TextMaxLen', parseInt(e.target.value))}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            min="1"
                            max="250"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Min Value (optional)
                          </label>
                          <input
                            type="number"
                            value={(param as any).NumberMin || ''}
                            onChange={(e) => updateParameter(index, 'NumberMin', e.target.value ? parseFloat(e.target.value) : undefined)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            step={param.InputType === 'Float' ? '0.01' : '1'}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Max Value (optional)
                          </label>
                          <input
                            type="number"
                            value={(param as any).NumberMax || ''}
                            onChange={(e) => updateParameter(index, 'NumberMax', e.target.value ? parseFloat(e.target.value) : undefined)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            step={param.InputType === 'Float' ? '0.01' : '1'}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => router.push('/admin/named-geometry')}
              className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md"
            >
              {loading ? 'Saving...' : (isNew ? 'Create Geometry' : 'Update Geometry')}
            </button>
          </div>
        </form>
      </div>
        </div>
      </div>
    </>
  );
}
