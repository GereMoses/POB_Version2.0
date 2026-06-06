/**
 * Frontend Performance Optimization Utilities
 * Provides performance monitoring and optimization helpers
 */

import { memo, useMemo, useCallback, useRef, useEffect, useState } from 'react';

// Performance monitoring
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = new Map();
  }

  // Measure component render time
  measureRender(componentName, renderFn) {
    const start = performance.now();
    const result = renderFn();
    const end = performance.now();
    
    const renderTime = end - start;
    this.recordMetric(`${componentName}_render`, renderTime);
    
    return result;
  }

  // Record performance metric
  recordMetric(name, value) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const metrics = this.metrics.get(name);
    metrics.push({
      value,
      timestamp: Date.now()
    });
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  // Get metric statistics
  getMetricStats(name) {
    const metrics = this.metrics.get(name) || [];
    if (metrics.length === 0) return null;
    
    const values = metrics.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return {
      count: metrics.length,
      average: avg,
      min,
      max,
      latest: values[values.length - 1]
    };
  }

  // Create performance observer
  createObserver(name, callback) {
    if (typeof PerformanceObserver !== 'undefined') {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        callback(entries);
      });
      
      observer.observe({ entryTypes: ['measure', 'navigation', 'paint'] });
      this.observers.set(name, observer);
      
      return observer;
    }
    return null;
  }

  // Disconnect observer
  disconnectObserver(name) {
    const observer = this.observers.get(name);
    if (observer) {
      observer.disconnect();
      this.observers.delete(name);
    }
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// React performance HOC
export const withPerformanceTracking = (WrappedComponent, componentName) => {
  const TrackedComponent = memo((props) => {
    const renderStartTime = useRef(null);
    
    useEffect(() => {
      renderStartTime.current = performance.now();
      
      return () => {
        if (renderStartTime.current) {
          const renderTime = performance.now() - renderStartTime.current;
          performanceMonitor.recordMetric(`${componentName}_render`, renderTime);
        }
      };
    });
    
    return <WrappedComponent {...props} />;
  });
  
  TrackedComponent.displayName = `withPerformanceTracking(${WrappedComponent.displayName || componentName})`;
  return TrackedComponent;
};

// Performance optimized hooks
export const usePerformanceMemo = (factory, deps) => {
  return useMemo(() => {
    const start = performance.now();
    const result = factory();
    const end = performance.now();
    
    performanceMonitor.recordMetric('useMemo_computation', end - start);
    return result;
  }, deps);
};

export const usePerformanceCallback = (fn, deps) => {
  return useCallback((...args) => {
    const start = performance.now();
    const result = fn(...args);
    const end = performance.now();
    
    performanceMonitor.recordMetric('callback_execution', end - start);
    return result;
  }, deps);
};

// Image lazy loading component
export const LazyImage = memo(({ src, alt, placeholder, className, style, ...props }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef();
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    if (imgRef.current) {
      observer.observe(imgRef.current);
    }
    
    return () => observer.disconnect();
  }, []);
  
  useEffect(() => {
    if (isInView && !isLoaded) {
      const img = new Image();
      img.onload = () => setIsLoaded(true);
      img.src = src;
    }
  }, [isInView, isLoaded, src]);
  
  return (
    <div
      ref={imgRef}
      className={className}
      style={{
        ...style,
        backgroundImage: isLoaded ? `url(${src})` : undefined,
        backgroundColor: placeholder ? '#f0f0f0' : 'transparent',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
      {...props}
    >
      {!isLoaded && placeholder && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#999'
        }}>
          Loading...
        </div>
      )}
    </div>
  );
});

// Virtual scrolling helper
export const useVirtualScroll = (items, itemHeight, containerHeight) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );
    
    return items.slice(startIndex, endIndex).map((item, index) => ({
      item,
      index: startIndex + index
    }));
  }, [items, itemHeight, containerHeight, scrollTop]);
  
  const totalHeight = items.length * itemHeight;
  
  return {
    visibleItems,
    totalHeight,
    onScroll: (e) => setScrollTop(e.target.scrollTop)
  };
};

// Debounce utility for performance
export const useDebounce = (callback, delay) => {
  const timeoutRef = useRef(null);
  
  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
};

// Throttle utility for performance
export const useThrottle = (callback, delay) => {
  const lastCallRef = useRef(0);
  
  return useCallback((...args) => {
    const now = Date.now();
    if (now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      callback(...args);
    }
  }, [callback, delay]);
};

// Performance monitoring component
export const PerformanceMetrics = ({ show = false }) => {
  const [metrics, setMetrics] = useState({});
  
  useEffect(() => {
    if (!show) return;
    
    const interval = setInterval(() => {
      const allMetrics = {};
      performanceMonitor.metrics.forEach((values, key) => {
        allMetrics[key] = performanceMonitor.getMetricStats(key);
      });
      setMetrics(allMetrics);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [show]);
  
  if (!show) return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: 10,
      right: 10,
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '4px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <h4>Performance Metrics</h4>
      {Object.entries(metrics).map(([key, stats]) => (
        <div key={key} style={{ marginBottom: '5px' }}>
          <div>{key}:</div>
          <div style={{ fontSize: '10px' }}>
            Avg: {stats.average?.toFixed(2)}ms | 
            Min: {stats.min?.toFixed(2)}ms | 
            Max: {stats.max?.toFixed(2)}ms
          </div>
        </div>
      ))}
    </div>
  );
};

// Bundle size analyzer
export const analyzeBundleSize = () => {
  if (typeof window !== 'undefined' && window.performance) {
    const navigation = performance.getEntriesByType('navigation')[0];
    if (navigation) {
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: navigation.responseStart - navigation.requestStart,
        totalLoadTime: navigation.loadEventEnd - navigation.requestStart
      };
    }
  }
  return null;
};

// Resource loading optimization
export const preloadResource = (url) => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = url;
  link.as = url.endsWith('.js') ? 'script' : 'image';
  document.head.appendChild(link);
};

export const prefetchResource = (url) => {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  document.head.appendChild(link);
};

// Memory leak detection
export const useMemoryLeakDetection = () => {
  const cleanupRefs = useRef([]);
  
  useEffect(() => {
    return () => {
      // Clean up all registered cleanup functions
      cleanupRefs.current.forEach(cleanup => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });
      cleanupRefs.current = [];
    };
  }, []);
  
  const registerCleanup = useCallback((cleanupFn) => {
    cleanupRefs.current.push(cleanupFn);
    
    // Return function to unregister this specific cleanup
    return () => {
      const index = cleanupRefs.current.indexOf(cleanupFn);
      if (index > -1) {
        cleanupRefs.current.splice(index, 1);
      }
    };
  }, []);
  
  return { registerCleanup };
};
