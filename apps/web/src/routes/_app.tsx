import { useEffect } from "react";
import { createRoute, Outlet } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { CommandPalette } from "@/components/shell/command-palette";
import { ShortcutsHelp } from "@/components/shell/shortcuts-help";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

function AppLayout() {
  useKeyboardShortcuts();

  // Apply persisted appearance preferences (density, reduced motion, font size)
  // right after the first paint. The settings page updates these live while
  // open; this covers reloads where the settings page was never visited.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("density-compact", "density-spacious", "reduce-motion");
    const density = localStorage.getItem("density");
    if (density === "compact") root.classList.add("density-compact");
    if (density === "spacious") root.classList.add("density-spacious");
    if (localStorage.getItem("reduced-motion") === "true") root.classList.add("reduce-motion");
    const fontSize = localStorage.getItem("font-size");
    if (fontSize === "large") root.style.fontSize = "18px";
    else if (fontSize === "small") root.style.fontSize = "13px";
    else root.style.fontSize = "16px";
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main
          id="main-content"
          className="flex-1 overflow-auto p-[calc(0.75rem*var(--density-scale))] md:p-[calc(1rem*var(--density-scale))]"
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>
      <CommandPalette />
      <ShortcutsHelp />
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  id: "_app",
  component: AppLayout,
});
