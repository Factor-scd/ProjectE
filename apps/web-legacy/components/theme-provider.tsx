'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/lib/stores/use-theme-store';
import { hexToHSL } from '@/lib/theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode, accent, density, reducedMotion } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;

    // Apply dark/light mode
    if (mode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent | MediaQueryList) => {
        root.classList.toggle('dark', e.matches);
      };
      handler(mediaQuery);
      mediaQuery.addEventListener(
        'change',
        handler as (e: MediaQueryListEvent) => void
      );
      return () =>
        mediaQuery.removeEventListener(
          'change',
          handler as (e: MediaQueryListEvent) => void
        );
    } else {
      root.classList.toggle('dark', mode === 'dark');
    }
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;

    // Apply accent color as CSS variable (convert hex to HSL for consistency)
    const hsl = hexToHSL(accent);
    root.style.setProperty('--primary', `${hsl.h} ${hsl.s}% ${hsl.l}%`);

    // Apply density
    root.setAttribute('data-density', density);

    // Apply reduced motion
    if (reducedMotion) {
      root.setAttribute('data-reduced-motion', 'true');
    } else {
      root.removeAttribute('data-reduced-motion');
    }
  }, [accent, density, reducedMotion]);

  return <>{children}</>;
}
