import { createRoute, useParams, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../../_app";
import { useApiQuery } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Layout, Layers } from "lucide-react";
import type { Canvas } from "@/lib/types";
import { format, parseISO } from "date-fns";

function CanvasDetail() {
  const { id } = useParams({ from: Route.id });
  const navigate = useNavigate();
  const { data: canvas, isLoading } = useApiQuery<Canvas>(["canvas", id], "/canvas/" + id);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!canvas) return <div className="p-8 text-center text-muted-foreground">Canvas not found</div>;

  const blockCount = canvas.cards?.length || 0;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Button variant="ghost" onClick={() => navigate({ to: "/canvas" })} className="w-fit">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Canvas
      </Button>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Layout className="h-6 w-6 text-muted-foreground" />
            <CardTitle className="text-2xl">{canvas.name}</CardTitle>
            <Badge variant="secondary">{canvas.mode}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {canvas.description && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-1">Description</h3>
              <p className="text-sm whitespace-pre-wrap">{canvas.description}</p>
            </div>
          )}
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-3 bg-muted/50 rounded-lg">
              <Layers className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{blockCount}</p>
              <p className="text-xs text-muted-foreground">Blocks</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <Layout className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold capitalize">{canvas.mode}</p>
              <p className="text-xs text-muted-foreground">Mode</p>
            </div>
          </div>
          <Separator />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Created: {format(parseISO(canvas.createdAt), "MMM d, yyyy HH:mm")}</p>
            <p>Updated: {format(parseISO(canvas.updatedAt), "MMM d, yyyy HH:mm")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "canvas/$id",
  component: CanvasDetail,
});
