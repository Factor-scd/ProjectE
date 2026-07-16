import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'light' | 'dark' | 'system';
type Density = 'compact' | 'comfortable' | 'spacious';

interface ThemeState {
  mode: ThemeMode;
  accent: string;
  font: string;
  density: Density;
  reducedMotion: boolean;

  // Actions
  setMode: (mode: ThemeMode) => void;
  setAccent: (color: string) => void;
  setFont: (font: string) => void;
  setDensity: (density: Density) => void;
  setReducedMotion: (enabled: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      accent: '#356bff',
      font: 'geist',
      density: 'comfortable',
      reducedMotion: false,

      setMode: (mode) => set({ mode }),
      setAccent: (accent) => set({ accent }),
      setFont: (font) => set({ font }),
      setDensity: (density) => set({ density }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
    }),
    {
      name: 'project-e-theme',
    }
  )
);
