import { createRoute, useParams, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../../_app";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar, Clock, FileText, LayoutDashboard, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { api, useApiQuery } from "@/lib/api";
import { useRealtime } from "@/hooks/use-realtime";
import { useOptimisticPatch } from "@/hooks/use-optimistic-patch";
import { InlineTextarea } from "@/components/entities/inline-edit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/state";
import type { Canvas } from "@/lib/types";
import { CanvasEditor } from "../canvas";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

function formatCustomFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function CanvasDetail() {
  const { id } = useParams({ from: Route.id });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useRealtime({ enabled: true });

  const { data: canvas, isLoading, isError, error, refetch } = useApiQuery<Canvas>(
    ["canvas", id],
    "/canvas/" + id
  );

  const { patch } = useOptimisticPatch<Canvas>({
    entityKey: ["canvas", id],
    listKeys: [["canvas"]],
    patchUrl: (cid) => `/canvas/${cid}`,
    applyPatch: (current, data) => ({ ...current, ...data }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/canvas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canvas"] });
      toast.success("Canvas deleted");
      navigate({ to: "/canvas" });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <LoadingState label="Loading canvas..." />;
  if (isError) {
    return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  }
  if (!canvas) return <ErrorState message="Canvas not found" />;

  const customFieldEntries = Object.entries(canvas.customFields ?? {});

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          <CanvasEditor key={canvas.id} canvas={canvas} onBack={() => navigate({ to: "/canvas" })} />
        </div>
        <aside className="w-full shrink-0 space-y-6 lg:w-72">
          <div>
            <p className="mb-1 text-sm font-semibold text-muted-foreground">Description</p>
            <InlineTextarea
              value={canvas.description ?? ""}
              onSave={(description) =>
                patch({ id, data: { description: description || null } })
              }
              placeholder="Add a description…"
            />
          </div>

          <div>
            <p className="mb-1 text-sm font-semibold text-muted-foreground">Details</p>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Badge variant="outline">{canvas.mode}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{canvas.cards?.length ?? 0} blocks</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>Created {format(parseISO(canvas.createdAt), "MMM d, yyyy HH:mm")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>Updated {format(parseISO(canvas.updatedAt), "MMM d, yyyy HH:mm")}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-semibold text-muted-foreground">Tags</p>
            {canvas.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {canvas.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No tags</p>
            )}
          </div>

          {customFieldEntries.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-semibold text-muted-foreground">Custom fields</p>
              <dl className="space-y-2">
                {customFieldEntries.map(([key, value]) => (
                  <div key={key} className="flex items-baseline justify-between gap-2 text-sm">
                    <dt className="shrink-0 text-muted-foreground">{key}</dt>
                    <dd className="truncate text-right">{formatCustomFieldValue(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="border-t pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="h-4 w-4" /> Delete Canvas
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Canvas</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{canvas.name}"? All blocks in it will be
                    removed. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground"
                    onClick={() => deleteMutation.mutate()}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </aside>
      </div>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "canvas/$id",
  component: CanvasDetail,
});
