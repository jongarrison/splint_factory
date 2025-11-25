'use client';

import { useState, useEffect, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { GeometryInputParameter, InputType } from '@/types/geometry-input-parameter';
import Header from '@/components/navigation/Header';
import { INPUT_NAME_PATTERN, INPUT_NAME_PATTERN_STRING, INPUT_NAME_ALLOWED_CHARS } from '@/constants/validation';

interface FormData {
  GeometryName: string;
  GeometryAlgorithmName: string;
  shortDescription: string;
  isActive: boolean;
  parameters: GeometryInputParameter[];
}

interface ImageFiles {
  preview: File | null;
  measurement: File | null;
}

export default function EditNamedGeometryPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const resolvedParams = use(params);
  const [formData, setFormData] = useState<FormData>({
    GeometryName: '',
    GeometryAlgorithmName: '',
    shortDescription: '',
    isActive: true,
    parameters: []
  });
  const [imageFiles, setImageFiles] = useState<ImageFiles>({
    preview: null,
    measurement: null
  });
  const [existingImages, setExistingImages] = useState<{
    preview: boolean;
    measurement: boolean;
  }>({
    preview: false,
    measurement: false
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
        shortDescription: data.shortDescription || '',
        isActive: data.isActive ?? true,
        parameters: parsedSchema
      });
      
      setExistingImages({
        preview: !!data.previewImageUpdatedAt,
        measurement: !!data.measurementImageUpdatedAt
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
          InputType: 'Float' as InputType,
          NumberMin: 0,
          NumberMax: 100
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

  const moveParameter = (index: number, direction: 'up' | 'down') => {
    setFormData(prev => {
      const newParams = [...prev.parameters];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      
      if (targetIndex < 0 || targetIndex >= newParams.length) {
        return prev;
      }
      
      [newParams[index], newParams[targetIndex]] = [newParams[targetIndex], newParams[index]];
      
      return {
        ...prev,
        parameters: newParams
      };
    });
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

  const handleImageChange = (type: 'preview' | 'measurement', file: File | null) => {
    if (!file) {
      setImageFiles(prev => ({ ...prev, [type]: null }));
      return;
    }
    
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError(`${type === 'preview' ? 'Preview' : 'Measurement'} image must be PNG, JPG, or WebP`);
      return;
    }
    
    // Validate file size
    const maxSize = type === 'preview' ? 500 * 1024 : 2 * 1024 * 1024; // 500KB or 2MB
    if (file.size > maxSize) {
      const maxMB = type === 'preview' ? '500KB' : '2MB';
      setError(`${type === 'preview' ? 'Preview' : 'Measurement'} image must be less than ${maxMB}`);
      return;
    }
    
    setImageFiles(prev => ({ ...prev, [type]: file }));
    setError(null);
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
      
      if (!INPUT_NAME_PATTERN.test(param.InputName)) {
        setError(`Parameter ${i + 1}: Input Name must contain only ${INPUT_NAME_ALLOWED_CHARS}`);
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
      
      const formPayload = new FormData();
      formPayload.append('GeometryName', formData.GeometryName.trim());
      formPayload.append('GeometryAlgorithmName', formData.GeometryAlgorithmName.trim());
      formPayload.append('shortDescription', formData.shortDescription.trim());
      formPayload.append('isActive', String(formData.isActive));
      formPayload.append('GeometryInputParameterSchema', JSON.stringify(formData.parameters));
      
      if (imageFiles.preview) {
        formPayload.append('previewImage', imageFiles.preview);
      }
      if (imageFiles.measurement) {
        formPayload.append('measurementImage', imageFiles.measurement);
      }
      
      const url = isNew ? '/api/named-geometry' : `/api/named-geometry/${resolvedParams.id}`;
      const method = isNew ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method,
        body: formPayload
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save geometry');
      }
      
      setSuccess(isNew ? 'Geometry created successfully!' : 'Geometry updated successfully!');
      
      if (isNew) {
        // Redirect to list after creating
        setTimeout(() => router.push('/admin/named-geometry'), 1500);
      } else {
        // Refresh existing images state
        const data = await response.json();
        setExistingImages({
          preview: !!data.previewImageUpdatedAt,
          measurement: !!data.measurementImageUpdatedAt
        });
        setImageFiles({ preview: null, measurement: null });
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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center dark:text-gray-200">Loading...</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          {isNew ? 'Create New Named Geometry' : 'Edit Named Geometry'}
        </h1>
        
        {error && (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-200 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Basic Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Geometry Name
                </label>
                <input
                  type="text"
                  value={formData.GeometryName}
                  onChange={(e) => setFormData(prev => ({ ...prev, GeometryName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={250}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Algorithm Name (no spaces)
                </label>
                <input
                  type="text"
                  value={formData.GeometryAlgorithmName}
                  onChange={(e) => setFormData(prev => ({ ...prev, GeometryAlgorithmName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={250}
                  pattern="[^\s]+"
                  required
                />
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Short Description (for landing page)
              </label>
              <textarea
                value={formData.shortDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, shortDescription: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={250}
                rows={2}
                placeholder="Brief description shown on geometry selection page"
              />
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Active (visible on geometry selection page)
              </label>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Images</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Preview Image (max 500KB)
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Shown as thumbnail on geometry selection page
                </p>
                {existingImages.preview && !imageFiles.preview && (
                  <div className="mb-2 text-sm text-green-600 dark:text-green-400">
                    ✓ Current image exists
                  </div>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => handleImageChange('preview', e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900 file:text-blue-700 dark:file:text-blue-200 hover:file:bg-blue-100 dark:hover:file:bg-blue-800"
                />
                {imageFiles.preview && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Selected: {imageFiles.preview.name} ({Math.round(imageFiles.preview.size / 1024)}KB)
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Measurement Image (max 2MB)
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Shown as helper guide when creating geometry jobs
                </p>
                {existingImages.measurement && !imageFiles.measurement && (
                  <div className="mb-2 text-sm text-green-600 dark:text-green-400">
                    ✓ Current image exists
                  </div>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => handleImageChange('measurement', e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900 file:text-blue-700 dark:file:text-blue-200 hover:file:bg-blue-100 dark:hover:file:bg-blue-800"
                />
                {imageFiles.measurement && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Selected: {imageFiles.measurement.name} ({Math.round(imageFiles.measurement.size / 1024)}KB)
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Input Parameters</h2>
              <button
                type="button"
                onClick={addParameter}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-sm"
              >
                Add Parameter
              </button>
            </div>
            
            {formData.parameters.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">No parameters defined</p>
            ) : (
              <div className="space-y-4">
                {formData.parameters.map((param, index) => (
                  <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Parameter {index + 1}</h3>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => moveParameter(index, 'up')}
                            disabled={index === 0}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed text-xs px-1"
                            title="Move up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => moveParameter(index, 'down')}
                            disabled={index === formData.parameters.length - 1}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed text-xs px-1"
                            title="Move down"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeParameter(index)}
                        className="text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Input Name ({INPUT_NAME_ALLOWED_CHARS})
                        </label>
                        <input
                          type="text"
                          value={param.InputName}
                          onChange={(e) => updateParameter(index, 'InputName', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          pattern={INPUT_NAME_PATTERN_STRING}
                          maxLength={50}
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Type
                        </label>
                        <select
                          value={param.InputType}
                          onChange={(e) => updateParameter(index, 'InputType', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        >
                          <option value="Text">Text</option>
                          <option value="Integer">Integer</option>
                          <option value="Float">Float</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Description
                      </label>
                      <textarea
                        value={param.InputDescription}
                        onChange={(e) => updateParameter(index, 'InputDescription', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        maxLength={250}
                        rows={2}
                        required
                      />
                    </div>
                    
                    {param.InputType === 'Text' ? (
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Min Length
                          </label>
                          <input
                            type="number"
                            value={(param as any).TextMinLen || 0}
                            onChange={(e) => updateParameter(index, 'TextMinLen', parseInt(e.target.value))}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            min="0"
                            max="250"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Max Length
                          </label>
                          <input
                            type="number"
                            value={(param as any).TextMaxLen || 1}
                            onChange={(e) => updateParameter(index, 'TextMaxLen', parseInt(e.target.value))}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            min="1"
                            max="250"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Min Value (optional)
                          </label>
                          <input
                            type="number"
                            value={(param as any).NumberMin || ''}
                            onChange={(e) => updateParameter(index, 'NumberMin', e.target.value ? parseFloat(e.target.value) : undefined)}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            step={param.InputType === 'Float' ? '0.01' : '1'}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Max Value (optional)
                          </label>
                          <input
                            type="number"
                            value={(param as any).NumberMax || ''}
                            onChange={(e) => updateParameter(index, 'NumberMax', e.target.value ? parseFloat(e.target.value) : undefined)}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
              className="bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 text-white px-4 py-2 rounded-md"
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
