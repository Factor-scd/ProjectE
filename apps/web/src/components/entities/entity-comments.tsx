import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Bot } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, LoadingState } from "@/components/state";
import { api, useApiMutation, useApiQuery } from "@/lib/api";
import type { Comment } from "@/lib/types";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";

interface EntityCommentsProps {
  entityType: string;
  entityId: string;
}

interface CommentsResponse {
  items: Comment[];
}

interface CreateCommentVariables {
  entityType: string;
  entityId: string;
  content: string;
  parentId?: string | null;
}

interface CommentNode {
  comment: Comment;
  children: CommentNode[];
}

/** Assemble the flat, oldest-first API list into a reply tree via parentId. */
function buildCommentTree(items: Comment[]): CommentNode[] {
  const childrenByParent = new Map<string, Comment[]>();
  for (const item of items) {
    const key = item.parentId ?? "__root__";
    const siblings = childrenByParent.get(key);
    if (siblings) siblings.push(item);
    else childrenByParent.set(key, [item]);
  }
  const build = (parentId: string): CommentNode[] =>
    (childrenByParent.get(parentId) ?? []).map((comment) => ({
      comment,
      children: build(comment.id),
    }));
  return build("__root__");
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join("") || "?"
  );
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

interface CommentComposerProps {
  entityType: string;
  entityId: string;
  parentId?: string | null;
  submitLabel?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmitted?: () => void;
}

/**
 * Inline comment/reply composer. Each instance owns its text + mutation state,
 * so the top composer and any open reply composer are independent and neither
 * can double-submit.
 */
function CommentComposer({
  entityType,
  entityId,
  parentId = null,
  submitLabel = "Comment",
  placeholder = "Write a comment... (use @agent to mention)",
  autoFocus = false,
  onSubmitted,
}: CommentComposerProps) {
  const queryClient = useQueryClient();
  const activeDomainId = useApiDomain();
  const [content, setContent] = useState("");
  const showMentionHint = content.includes("@");

  const createMutation = useApiMutation<Comment, CreateCommentVariables>(
    "post",
    "/comments",
    {
      onSuccess: (c) => {
        queryClient.invalidateQueries({ queryKey: ["comments", entityType, entityId] });
        queryClient.invalidateQueries({ queryKey: ["agent-activity"] });
        toast.success("Comment added");
        if (content.includes("@")) {
          fetch("/api/agents/dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commentId: (c as any).id || "", entityType, entityId, workspaceId: activeDomainId }) }).catch(()=>{});
          toast.info("Agent notified via @mention");
        }
        setContent("");
        onSubmitted?.();
      },
      onError: (err) => toast.error(errorMessage(err)),
    }
  );

  const canSubmit = content.trim().length > 0 && !createMutation.isPending;

  const submit = () => {
    const trimmed = content.trim();
    if (!trimmed || createMutation.isPending) return;
    createMutation.mutate({
      entityType,
      entityId,
      content: trimmed,
      parentId,
    });
  };

  return (
    <div className="space-y-2">
      <Textarea
        rows={2}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      {showMentionHint && <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Bot className="h-3 w-3" /> @mention will notify agents</p>}
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={!canSubmit}>
          {createMutation.isPending ? "Posting..." : submitLabel}
        </Button>
      </div>
    </div>
  );
}

interface CommentThreadProps {
  node: CommentNode;
  onDelete: (id: string) => void;
  deletePending: boolean;
}

/** A comment plus its nested replies, indented one level per depth. */
function CommentThread({ node, onDelete, deletePending }: CommentThreadProps) {
  const { comment, children } = node;
  const [replying, setReplying] = useState(false);

  return (
    <div>
      <div className="group">
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials(comment.author)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-medium">{comment.author}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {formatDistanceToNow(parseISO(comment.createdAt), { addSuffix: true })}
              </span>
            </p>
            <p className="mt-0.5 text-sm whitespace-pre-wrap text-foreground/90">
              {comment.content}
            </p>
            <div className="mt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setReplying((value) => !value)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Reply
              </button>
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
                disabled={deletePending}
                aria-label="Delete comment"
                title="Delete comment"
                className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            {replying ? (
              <div className="mt-2">
                <CommentComposer
                  entityType={comment.entityType}
                  entityId={comment.entityId}
                  parentId={comment.id}
                  submitLabel="Reply"
                  placeholder="Write a reply..."
                  autoFocus
                  onSubmitted={() => setReplying(false)}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {children.length > 0 ? (
        <div className="ml-6 mt-4 space-y-4 border-l pl-4">
          {children.map((child) => (
            <CommentThread
              key={child.comment.id}
              node={child}
              onDelete={onDelete}
              deletePending={deletePending}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Threaded comments for a single entity. The API returns a flat list
 * (oldest-first); the reply tree is assembled from `parentId` here. Deleting a
 * comment soft-deletes its descendants server-side, so invalidating the query
 * refreshes the whole subtree.
 */
export function EntityComments({ entityType, entityId }: EntityCommentsProps) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useApiQuery<CommentsResponse>(
    ["comments", entityType, entityId],
    `/comments?entityType=${entityType}&entityId=${entityId}`
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/comments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", entityType, entityId] });
      toast.success("Comment deleted");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const tree = useMemo(() => buildCommentTree(data?.items ?? []), [data?.items]);

  return (
    <div className="space-y-4">
      <CommentComposer entityType={entityType} entityId={entityId} />
      {isLoading ? <LoadingState label="Loading comments..." /> : null}
      {isError ? (
        <ErrorState
          message={error instanceof Error ? error.message : "Failed to load comments"}
          onRetry={() => refetch()}
        />
      ) : null}
      {!isLoading && !isError && tree.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No comments yet — start the conversation.
        </p>
      ) : null}
      {!isLoading && !isError && tree.length > 0 ? (
        <div className="divide-y">
          {tree.map((node) => (
            <CommentThread
              key={node.comment.id}
              node={node}
              onDelete={(id) => deleteMutation.mutate(id)}
              deletePending={deleteMutation.isPending}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
