import { createRoute, useParams, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../../_app";
import { useApiQuery } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, FileText, Clock } from "lucide-react";
import type { Note } from "@/lib/types";
import { format, parseISO } from "date-fns";

function NoteDetail() {
  const { id } = useParams({ from: Route.id });
  const navigate = useNavigate();
  const { data: note, isLoading } = useApiQuery<Note>(["note", id], "/notes/" + id);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!note) return <div className="p-8 text-center text-muted-foreground">Note not found</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Button variant="ghost" onClick={() => navigate({ to: "/notes" })} className="w-fit">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Notes
      </Button>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-muted-foreground" />
            <CardTitle className="text-2xl">{note.title}</CardTitle>
            {note.isPinned && <Badge>Pinned</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Created {format(parseISO(note.createdAt), "MMM d, yyyy HH:mm")}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Updated {format(parseISO(note.updatedAt), "MMM d, yyyy HH:mm")}</span>
          </div>
          <Separator />
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-sm whitespace-pre-wrap">{note.content || "No content"}</p>
          </div>
          {note.tags && note.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {note.tags.map((t: any) => (
                  <Badge key={t.id || t.name} variant="secondary">{t.name || t}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "notes/$id",
  component: NoteDetail,
});
