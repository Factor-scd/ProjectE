import { useEffect } from "react";
import { useThemeStore, ACCENT_PALETTE, type AccentColor } from "@/lib/stores/use-theme-store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode, accent } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;

    // Apply dark/light mode
    if (mode === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent | MediaQueryList) => {
        root.classList.toggle("dark", e.matches);
      };
      handler(mediaQuery);
      mediaQuery.addEventListener("change", handler as (e: MediaQueryListEvent) => void);
      return () =>
        mediaQuery.removeEventListener("change", handler as (e: MediaQueryListEvent) => void);
    } else {
      root.classList.toggle("dark", mode === "dark");
    }
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    const palette = ACCENT_PALETTE[accent as AccentColor] || ACCENT_PALETTE.blue;
    root.style.setProperty("--accent-hsl", palette.hsl);
  }, [accent]);

  return <>{children}</>;
}
