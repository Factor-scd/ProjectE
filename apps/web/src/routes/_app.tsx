import { createRoute, Outlet } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { CommandPalette } from "@/components/shell/command-palette";
import { ShortcutsHelp } from "@/components/shell/shortcuts-help";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

function AppLayout() {
  useKeyboardShortcuts();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main
          id="main-content"
          className="flex-1 overflow-auto p-4 md:p-6"
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
