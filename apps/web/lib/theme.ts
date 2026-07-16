// Theme configuration and utilities

export const ACCENT_COLORS = [
  { name: 'Blue', value: '#356bff' },
  { name: 'Green', value: '#256e4b' },
  { name: 'Coral', value: '#e86f51' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Amber', value: '#d99a33' },
  { name: 'Rose', value: '#e11d48' },
  { name: 'Teal', value: '#0d9488' },
  { name: 'Indigo', value: '#4f46e5' },
] as const;

export const FONTS = [
  { name: 'Geist', value: 'geist' },
  { name: 'System', value: 'system' },
  { name: 'Serif', value: 'serif' },
  { name: 'Mono', value: 'mono' },
] as const;

export const DENSITIES = [
  { name: 'Compact', value: 'compact', description: 'Tighter spacing, more content visible' },
  { name: 'Comfortable', value: 'comfortable', description: 'Balanced spacing' },
  { name: 'Spacious', value: 'spacious', description: 'More breathing room' },
] as const;

export const THEME_MODES = [
  { name: 'Light', value: 'light' },
  { name: 'Dark', value: 'dark' },
  { name: 'System', value: 'system' },
] as const;

/**
 * Convert hex color to HSL components for CSS variable usage.
 */
export function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Get font family string from font value.
 */
export function getFontFamily(font: string): string {
  switch (font) {
    case 'geist':
      return 'var(--font-geist-sans), system-ui, sans-serif';
    case 'system':
      return 'system-ui, -apple-system, sans-serif';
    case 'serif':
      return 'Georgia, "Times New Roman", serif';
    case 'mono':
      return 'var(--font-geist-mono), monospace';
    default:
      return 'var(--font-geist-sans), system-ui, sans-serif';
  }
}
