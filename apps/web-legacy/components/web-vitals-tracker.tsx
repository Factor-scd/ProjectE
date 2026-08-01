'use client';

import { useWebVitals } from '@/hooks/use-web-vitals';

/**
 * Thin client component that hooks Web Vitals tracking into the layout.
 * Kept separate so the layout itself stays a server component.
 */
export function WebVitalsTracker() {
  useWebVitals();
  return null;
}
