'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSmartPolling } from '@/hooks/useSmartPolling';
import StlViewer from '@/components/StlViewer';

interface GeometryJob {
  id: string;
  objectID?: string;
  ProcessStartedTime?: string;
  ProcessCompletedTime?: string;
  isProcessSuccessful: boolean;
  geometry: {
    GeometryName: string;
  };
}

interface GeometryJobProgressModalProps {
  jobId: string;
  onClose: () => void;
}

export default function GeometryJobProgressModal({ jobId, onClose }: GeometryJobProgressModalProps) {
  const router = useRouter();
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Poll for job status using the same infrastructure as the list page
  const { 
    data: job, 
    isLoading,
    error 
  } = useSmartPolling<GeometryJob>(`/api/geometry-jobs/${jobId}`, {
    fastInterval: 2000, // Poll every 2 seconds
    enabled: true
  });

  // Check if job is complete
  useEffect(() => {
    if (job?.ProcessCompletedTime) {
      if (job.isProcessSuccessful) {
        setShowSuccess(true);
      }
      // If failed, we just keep showing the status - user can see it failed
    }
  }, [job]);

  const handleDismiss = () => {
    // Navigate to the specific geometry job view page
    router.push(`/admin/geometry-jobs/${jobId}`);
    onClose();
  };

  const handleViewPrintQueue = () => {
    router.push('/admin/print-queue');
    onClose();
  };

  const getStatusDisplay = () => {
    if (isLoading && !job) {
      return {
        icon: '⏳',
        title: 'Loading job status...',
        message: 'Please wait',
        color: 'text-blue-600'
      };
    }

    if (error) {
      return {
        icon: '⚠️',
        title: 'Error loading job status',
        message: error,
        color: 'text-red-600'
      };
    }

    if (!job) {
      return {
        icon: '⏳',
        title: 'Waiting for job...',
        message: 'Please wait',
        color: 'text-blue-600'
      };
    }

    if (job.ProcessCompletedTime && job.isProcessSuccessful) {
      return {
        icon: '✅',
        title: 'Processing Complete!',
        message: `${job.geometry.GeometryName} has been successfully processed and is ready to print.`,
        color: 'text-green-600'
      };
    }

    if (job.ProcessCompletedTime && !job.isProcessSuccessful) {
      return {
        icon: '❌',
        title: 'Processing Failed',
        message: `${job.geometry.GeometryName} processing encountered an error. View details for more information.`,
        color: 'text-red-600'
      };
    }

    if (job.ProcessStartedTime) {
      return {
        icon: '⚙️',
        title: 'Processing Geometry...',
        message: `Processing ${job.geometry.GeometryName}. This may take a few moments.`,
        color: 'text-yellow-600'
      };
    }

    return {
      icon: '📋',
      title: 'Job Queued',
      message: `${job.geometry.GeometryName} is waiting to be processed.`,
      color: 'text-blue-600'
    };
  };

  const status = getStatusDisplay();
  const isComplete = job?.ProcessCompletedTime !== undefined;
  const isSuccess = job?.isProcessSuccessful === true;

  return (
    <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full p-6 relative ${
        isComplete && isSuccess ? 'max-w-3xl' : 'max-w-md'
      }`}>
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors z-10"
          title="Close and view job details"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Status icon and title */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">{status.icon}</div>
          <h2 className={`text-2xl font-bold ${status.color} mb-2`}>
            {status.title}
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            {status.message}
          </p>
          {job?.objectID && (
            <div className="mt-4 inline-block bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-lg">
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Object ID</div>
              <div className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400">
                {job.objectID}
              </div>
            </div>
          )}
        </div>

        {/* STL Viewer for successful completion */}
        {isComplete && isSuccess && job && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Preview
            </h3>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <StlViewer
                url={`/api/geometry-jobs/${jobId}/geometry-file`}
                width="100%"
                height={400}
              />
            </div>
          </div>
        )}

        {/* Animated spinner for in-progress states */}
        {!isComplete && (
          <div className="flex justify-center mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          {isComplete && isSuccess && (
            <button
              onClick={handleViewPrintQueue}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              View Print Queue →
            </button>
          )}
          
          <button
            onClick={handleDismiss}
            className={`w-full ${
              isComplete && isSuccess
                ? 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            } font-semibold py-3 px-4 rounded-lg transition-colors`}
          >
            {isComplete 
              ? 'View Job Details' 
              : 'Dismiss & View Details'
            }
          </button>
        </div>

        {/* Helpful hint */}
        {!isComplete && (
          <p className="text-xs text-gray-500 text-center mt-4">
            You can safely dismiss this and check the status later.
          </p>
        )}
      </div>
    </div>
  );
}
