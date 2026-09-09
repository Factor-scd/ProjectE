import type { ReactNode } from "react";
import { Loader2, Inbox, AlertCircle, RotateCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Centered loading state with a spinner and optional label.
 * Drop-in replacement for inline `<div className="py-12 text-center">Loading...</div>` markup.
 */
export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      {label ? <p className="text-xs">{label}</p> : null}
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
  color,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Icon className={`h-5 w-5 ${color ?? "text-muted-foreground"}`} />
      </div>
      <div className="space-y-0.5">
        <p className="text-sm font-semibold">{title}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="pt-0.5">{action}</div> : null}
    </div>
  );
}

/**
 * Centered error state with a destructive-styled message and an optional
 * retry button that re-runs the failed query.
 */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <AlertCircle className="h-5 w-5 text-destructive" />
      <p className="text-xs font-medium text-destructive font-mono">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw className="h-3 w-3" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
