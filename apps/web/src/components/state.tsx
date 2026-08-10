import type { ReactNode } from "react";
import { Loader2, Inbox, AlertCircle, RotateCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Centered loading state with a spinner and optional label.
 * Drop-in replacement for inline `<div className="py-12 text-center">Loading...</div>` markup.
 */
export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}

/**
 * Centered empty state: icon, title, optional description and optional CTA.
 * `action` is rendered below the text (e.g. a Button that opens a create dialog).
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

/**
 * Centered error state with a destructive-styled message and an optional
 * retry button that re-runs the failed query.
 */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="text-sm font-medium text-destructive">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw className="h-4 w-4" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
