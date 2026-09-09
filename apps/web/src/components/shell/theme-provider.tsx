import { useEffect } from "react";
import { useThemeStore } from "@/lib/stores/use-theme-store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;

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

  return <>{children}</>;
}
