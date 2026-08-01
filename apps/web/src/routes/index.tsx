import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root";

function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">Project E — UI Redesign</h1>
      <p className="text-lg text-muted-foreground">Phase 1 Scaffold</p>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});
