import { createRoute, useParams, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../../_app";
import { useApiQuery } from "@/lib/api";
import type { Canvas } from "@/lib/types";
import { CanvasEditor } from "../canvas";

function CanvasDetail() {
  const { id } = useParams({ from: Route.id });
  const navigate = useNavigate();
  const { data: canvas, isLoading } = useApiQuery<Canvas>(["canvas", id], "/canvas/" + id);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!canvas) return <div className="p-8 text-center text-muted-foreground">Canvas not found</div>;

  return <CanvasEditor key={canvas.id} canvas={canvas} onBack={() => navigate({ to: "/canvas" })} />;
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "canvas/$id",
  component: CanvasDetail,
});
