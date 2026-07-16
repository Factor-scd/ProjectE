'use client';

import { useEffect } from 'react';

/**
 * Reports Core Web Vitals (LCP, CLS, INP) via PerformanceObserver.
 * Only runs in production to avoid noise in development.
 */
function reportMetric(name: string, value: number, rating: 'good' | 'needs-improvement' | 'poor') {
  if (process.env.NODE_ENV !== 'production') return;

  const body = JSON.stringify({
    name,
    value,
    rating,
    page: window.location.pathname,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
  });

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/vitals', body);
  }
}

function getLCPRating(value: number): 'good' | 'needs-improvement' | 'poor' {
  if (value <= 2500) return 'good';
  if (value <= 4000) return 'needs-improvement';
  return 'poor';
}

function getCLSRating(value: number): 'good' | 'needs-improvement' | 'poor' {
  if (value <= 0.1) return 'good';
  if (value <= 0.25) return 'needs-improvement';
  return 'poor';
}

function getINPRating(value: number): 'good' | 'needs-improvement' | 'poor' {
  if (value <= 200) return 'good';
  if (value <= 500) return 'needs-improvement';
  return 'poor';
}

export function useWebVitals() {
  useEffect(() => {
    if (typeof PerformanceObserver === 'undefined') return;

    // LCP — Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1] as unknown as PerformanceEntry & { startTime: number };
      if (lastEntry) {
        reportMetric('LCP', lastEntry.startTime, getLCPRating(lastEntry.startTime));
      }
    });

    try {
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // Not supported
    }

    // CLS — Cumulative Layout Shift
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!(entry as unknown as { hadRecentInput?: boolean }).hadRecentInput) {
          clsValue += (entry as unknown as { value: number }).value;
          reportMetric('CLS', clsValue, getCLSRating(clsValue));
        }
      }
    });

    try {
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch {
      // Not supported
    }

    // INP — Interaction to Next Paint
    let maxINP = 0;
    const inpObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const eventEntry = entry as unknown as { duration: number };
        if (eventEntry.duration > maxINP) {
          maxINP = eventEntry.duration;
          reportMetric('INP', maxINP, getINPRating(maxINP));
        }
      }
    });

    try {
      inpObserver.observe({ type: 'event', buffered: true });
    } catch {
      // Not supported
    }

    return () => {
      lcpObserver.disconnect();
      clsObserver.disconnect();
      inpObserver.disconnect();
    };
  }, []);
}
