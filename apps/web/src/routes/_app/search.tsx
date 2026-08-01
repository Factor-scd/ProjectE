import { createRoute } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";

function SearchPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-3xl font-bold mb-2">Search</h1>
      <p className="text-muted-foreground">Coming in T7 — full-text search.</p>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "/search",
  component: SearchPage,
});
