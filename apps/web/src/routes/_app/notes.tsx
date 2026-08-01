import { createRoute } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";

function NotesPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-3xl font-bold mb-2">Notes</h1>
      <p className="text-muted-foreground">Coming in T6 — notes and documents.</p>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "/notes",
  component: NotesPage,
});
