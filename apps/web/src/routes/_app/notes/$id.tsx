import { createRoute, useParams, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../../_app";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Clock,
  FileText,
  Link2,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { api, useApiQuery } from "@/lib/api";
import { useRealtime } from "@/hooks/use-realtime";
import { useOptimisticPatch } from "@/hooks/use-optimistic-patch";
import { EntityDetailPage } from "@/components/entities/detail-page";
import { InlineText } from "@/components/entities/inline-edit";
import { EntityActivity } from "@/components/entities/entity-activity";
import { EntityComments } from "@/components/entities/entity-comments";
import { TagManager } from "@/components/entities/tag-manager";
import { NoteEditor } from "@/components/entities/note-editor";
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
import type { Note } from "@/lib/types";

// Query keys to keep fresh after any note-affecting mutation. Mirrors the
// realtime hook's invalidation so the notes list and recent notes never go stale.
const LIST_KEYS: string[][] = [["notes"], ["recent-notes"]];

type PatchFn = (vars: { id: string; data: Record<string, unknown> }) => void;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

function NoteDetail() {
  const { id } = useParams({ from: Route.id });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useRealtime({ enabled: true });

  const { data: note, isLoading, isError, error, refetch } = useApiQuery<Note>(
    ["note", id],
    "/notes/" + id
  );

  const { patch } = useOptimisticPatch<Note>({
    entityKey: ["note", id],
    listKeys: LIST_KEYS,
    patchUrl: (nid) => `/notes/${nid}`,
    applyPatch: (current, data) => ({ ...current, ...data }),
  });

  const refreshLists = () => {
    for (const key of LIST_KEYS) queryClient.invalidateQueries({ queryKey: key });
  };

  const togglePin = useMutation({
    mutationFn: () =>
      api.patch<Note>(`/notes/${id}`, { isPinned: !note?.isPinned }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["note", id] });
      refreshLists();
      toast.success(note?.isPinned ? "Note unpinned" : "Note pinned");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const toggleArchive = useMutation({
    mutationFn: () =>
      api.patch<Note>(`/notes/${id}`, { isArchived: !note?.isArchived }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["note", id] });
      refreshLists();
      toast.success(note?.isArchived ? "Note unarchived" : "Note archived");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/notes/${id}`),
    onSuccess: () => {
      refreshLists();
      toast.success("Note deleted");
      navigate({ to: "/notes" });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <LoadingState label="Loading note..." />;
  if (isError) {
    return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  }
  if (!note) return <ErrorState message="Note not found" />;

  return (
    <EntityDetailPage
      backTo={{ to: "/notes", label: "Back to Notes" }}
      title={
        <InlineText
          value={note.title}
          onSave={(title) => patch({ id, data: { title } })}
          placeholder="Untitled note"
        />
      }
      icon={<FileText className="h-6 w-6" />}
      badges={note.isPinned ? <Badge>Pinned</Badge> : null}
      actions={
        <>
          <Button
            variant="outline"
            onClick={() => togglePin.mutate()}
            disabled={togglePin.isPending}
          >
            {note.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            {note.isPinned ? "Unpin" : "Pin"}
          </Button>
          <Button
            variant="outline"
            onClick={() => toggleArchive.mutate()}
            disabled={toggleArchive.isPending}
          >
            {note.isArchived ? (
              <ArchiveRestore className="h-4 w-4" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            {note.isArchived ? "Unarchive" : "Archive"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Note</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{note.title}"? This action cannot be
                  undone.
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
        </>
      }
      tabs={[
        {
          value: "editor",
          label: "Editor",
          content: <EditorTab note={note} patch={patch} />,
        },
        { value: "links", label: "Links", content: <LinksTab note={note} /> },
        {
          value: "activity",
          label: "Activity",
          content: <EntityActivity entityType="note" entityId={id} />,
        },
        {
          value: "comments",
          label: "Comments",
          content: <EntityComments entityType="note" entityId={id} />,
        },
      ]}
    />
  );
}

function EditorTab({ note, patch }: { note: Note; patch: PatchFn }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-sm font-semibold text-muted-foreground">Content</p>
        <div className="rounded-lg border">
          <NoteEditor
            key={note.id}
            initialContent={note.content ?? ""}
            onSave={(html) => patch({ id: note.id, data: { content: html } })}
            placeholder="Start writing..."
          />
        </div>
      </div>

      <div className="border-t pt-3">
        <TagManager entityType="note" entityId={note.id} tags={note.tags || []} />
      </div>

      <div className="flex items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Created <span className="font-mono">{format(parseISO(note.createdAt), "MMM d, yyyy HH:mm")}</span>
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Updated <span className="font-mono">{format(parseISO(note.updatedAt), "MMM d, yyyy HH:mm")}</span>
        </span>
      </div>
    </div>
  );
}

function LinksTab({ note }: { note: Note }) {
  const navigate = useNavigate();
  const backlinks = note.backlinks || [];
  const outgoingLinks = note.outgoingLinks || [];

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          Backlinks
        </h3>
        {backlinks.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No backlinks yet.</p>
        ) : (
          <div className="space-y-0.5">
            {backlinks.map((bl) => (
              <button
                key={bl.id}
                type="button"
                onClick={() => navigate({ to: "/notes/$id", params: { id: bl.id } })}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50"
              >
                <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm hover:underline">{bl.title}</span>
                  {bl.excerpt ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {bl.excerpt}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          Outgoing links
        </h3>
        {outgoingLinks.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No outgoing links.</p>
        ) : (
          <div className="space-y-0.5">
            {outgoingLinks.map((link) => (
              <button
                key={link.noteId}
                type="button"
                onClick={() => navigate({ to: "/notes/$id", params: { id: link.noteId } })}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/50"
              >
                <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm hover:underline">
                  {link.noteTitle}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "notes/$id",
  component: NoteDetail,
});
