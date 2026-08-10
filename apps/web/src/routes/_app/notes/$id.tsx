import { createRoute, useParams, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../../_app";
import { useApiQuery } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TagManager } from "@/components/entities/tag-manager";
import { ArrowLeft, FileText, Clock } from "lucide-react";
import type { Note } from "@/lib/types";
import { format, parseISO } from "date-fns";

// Note content is Tiptap-generated HTML stored by the API. Lightweight sanitizer
// applied before rendering via dangerouslySetInnerHTML: drops script/style
// blocks, inline event handlers, and javascript: URLs.
const sanitizeNoteHtml = (html: string): string =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(\shref|\ssrc)\s*=\s*(?:"|')\s*javascript:[^"']*(?:"|')/gi, ' $1=""');

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
          {/* The @tailwindcss/typography plugin isn't installed, so style the
              Tiptap output with scoped CSS instead of `prose` classes. */}
          <div className="note-detail-content max-w-none">
            <style>{`
              .note-detail-content { line-height: 1.75; }
              .note-detail-content h1 { font-size: 1.75rem; font-weight: 700; line-height: 1.25; margin: 1.5rem 0 0.75rem; }
              .note-detail-content h2 { font-size: 1.5rem; font-weight: 700; line-height: 1.3; margin: 1.5rem 0 0.75rem; }
              .note-detail-content h3 { font-size: 1.25rem; font-weight: 600; line-height: 1.4; margin: 1.25rem 0 0.5rem; }
              .note-detail-content h4 { font-size: 1.125rem; font-weight: 600; line-height: 1.4; margin: 1rem 0 0.5rem; }
              .note-detail-content h5, .note-detail-content h6 { font-size: 1rem; font-weight: 600; margin: 1rem 0 0.5rem; }
              .note-detail-content p { margin: 0.75rem 0; }
              .note-detail-content a { color: hsl(var(--primary)); text-decoration: underline; }
              .note-detail-content ul { list-style: disc; padding-left: 1.5rem; margin: 0.75rem 0; }
              .note-detail-content ol { list-style: decimal; padding-left: 1.5rem; margin: 0.75rem 0; }
              .note-detail-content li { margin: 0.25rem 0; }
              .note-detail-content li p { margin: 0; }
              .note-detail-content blockquote { border-left: 3px solid hsl(var(--border)); padding-left: 1rem; margin: 1rem 0; color: hsl(var(--muted-foreground)); }
              .note-detail-content hr { border: 0; border-top: 1px solid hsl(var(--border)); margin: 1.5rem 0; }
              .note-detail-content code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.875em; background: hsl(var(--muted)); padding: 0.125rem 0.375rem; border-radius: 0.25rem; }
              .note-detail-content pre { background: hsl(var(--muted)); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; margin: 1rem 0; }
              .note-detail-content pre code { background: transparent; padding: 0; font-size: 0.875rem; }
              .note-detail-content ul[data-type="taskList"] { list-style: none; padding-left: 0.25rem; }
              .note-detail-content ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; }
              .note-detail-content ul[data-type="taskList"] li p { flex: 1; }
            `}</style>
            {note.content ? (
              <div dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(note.content) }} />
            ) : (
              <p className="text-sm text-muted-foreground">No content</p>
            )}
          </div>
          <TagManager entityType="note" entityId={note.id} tags={note.tags || []} />
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
