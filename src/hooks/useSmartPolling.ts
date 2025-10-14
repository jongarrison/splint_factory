import { useState, useEffect, useRef } from 'react';

interface UseSmartPollingOptions {
  fastInterval?: number;
  slowInterval?: number;
  idleThreshold?: number;
  enabled?: boolean;
}

interface UseSmartPollingResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  refresh: () => Promise<void>;
  isFetching: boolean;
}

export function useSmartPolling<T>(
  endpoint: string,
  options: UseSmartPollingOptions = {}
): UseSmartPollingResult<T> {
  const {
    fastInterval = 5000,
    slowInterval = 30000,
    idleThreshold = 120000,
    enabled = true
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const mountedRef = useRef(true);
  const activityRef = useRef(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const updateActivity = () => {
      activityRef.current = Date.now();
    };

    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('mousedown', updateActivity);
    window.addEventListener('keypress', updateActivity);
    window.addEventListener('scroll', updateActivity);
    window.addEventListener('touchstart', updateActivity);
    window.addEventListener('click', updateActivity);

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('mousedown', updateActivity);
      window.removeEventListener('keypress', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
      window.removeEventListener('click', updateActivity);
    };
  }, []);

  const refresh = async () => {
    if (!enabled) return;

    setIsFetching(true);
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      const result = await response.json();
      
      if (mountedRef.current) {
        setData(result);
        setError(null);
        setLastUpdate(new Date());
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    } finally {
      if (mountedRef.current) {
        setIsFetching(false);
      }
    }
  };

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const initialFetch = async () => {
      try {
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`);
        }
        const result = await response.json();
        
        if (mountedRef.current) {
          setData(result);
          setError(null);
          setLastUpdate(new Date());
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'An error occurred');
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    initialFetch();

    const schedulePoll = () => {
      const timeSinceActivity = Date.now() - activityRef.current;
      const interval = timeSinceActivity > idleThreshold ? slowInterval : fastInterval;

      timeoutRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;

        setIsFetching(true);
        try {
          const response = await fetch(endpoint);
          if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.statusText}`);
          }
          const result = await response.json();
          
          if (mountedRef.current) {
            setData(result);
            setError(null);
            setLastUpdate(new Date());
          }
        } catch (err) {
          if (mountedRef.current) {
            setError(err instanceof Error ? err.message : 'An error occurred');
          }
        } finally {
          if (mountedRef.current) {
            setIsFetching(false);
            schedulePoll();
          }
        }
      }, interval);
    };

    const startPolling = setTimeout(() => {
      if (mountedRef.current) {
        schedulePoll();
      }
    }, fastInterval);

    return () => {
      clearTimeout(startPolling);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, endpoint, fastInterval, slowInterval, idleThreshold]);

  return {
    data,
    isLoading,
    error,
    lastUpdate,
    refresh,
    isFetching
  };
}
