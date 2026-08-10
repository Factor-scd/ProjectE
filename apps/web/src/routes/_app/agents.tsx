import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";

function AgentsPage() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-3xl font-bold mb-2">Agent Activity</h1>
      <p className="text-muted-foreground mb-4">The agent activity feed moved to its own page.</p>
      <button onClick={() => navigate({ to: "/agents/activity" })} className="text-primary underline underline-offset-4">
        Open Agent Activity
      </button>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "/agents",
  component: AgentsPage,
});
