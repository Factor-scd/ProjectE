import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";
export type AccentColor = "slate" | "blue" | "green" | "purple" | "orange";

interface ThemeState {
  mode: ThemeMode;
  accent: AccentColor;

  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
}

export const ACCENT_PALETTE: Record<AccentColor, { name: string; hsl: string }> = {
  slate: { name: "Slate", hsl: "215 16% 47%" },
  blue: { name: "Blue", hsl: "217 91% 60%" },
  green: { name: "Green", hsl: "142 71% 45%" },
  purple: { name: "Purple", hsl: "271 81% 56%" },
  orange: { name: "Orange", hsl: "24 95% 53%" },
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "dark",
      accent: "blue",

      setMode: (mode) => set({ mode }),
      setAccent: (accent) => set({ accent }),
    }),
    {
      name: "project-e-theme",
    }
  )
);
