import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface DetailTab {
  value: string;
  label: string;
  content: ReactNode;
}

export interface EntityDetailPageProps {
  /** Back navigation. `to` is a TanStack Router route path (e.g. "/tasks"), label the button text. */
  backTo: { to: string; label: string };
  /** Title node — pages usually pass an InlineText-wrapped title or plain heading. */
  title: ReactNode;
  /** Optional leading icon next to the title (lucide icon component). */
  icon?: ReactNode;
  /** Badges row (status/priority/etc) under or beside the title. */
  badges?: ReactNode;
  /** Right-aligned action buttons (quick actions: complete, log, pin, delete...). */
  actions?: ReactNode;
  /** Tabs. Each renders its content in a TabsContent. */
  tabs: DetailTab[];
  /** Initial active tab. Defaults to the first tab. */
  defaultTab?: string;
  /** Sticky-header container class override (default "max-w-4xl"). */
  containerClassName?: string;
}

export function EntityDetailPage({
  backTo,
  title,
  icon,
  badges,
  actions,
  tabs,
  defaultTab,
  containerClassName,
}: EntityDetailPageProps) {
  const navigate = useNavigate();

  return (
    <div className={cn("mx-auto space-y-4 p-0", containerClassName || "max-w-4xl")}>
      <div className="sticky top-0 z-10 -mx-1 mb-2 border-b bg-background/95 py-2 backdrop-blur">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: backTo.to })}
          className="mb-2 h-7 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          {backTo.label}
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2.5">
            {icon && <div className="mt-0.5 text-muted-foreground">{icon}</div>}
            <div className="space-y-1">
              <h1 className="text-xl font-bold leading-tight">{title}</h1>
              {badges && (
                <div className="flex flex-wrap items-center gap-1.5">{badges}</div>
              )}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </div>
      </div>

      <Tabs defaultValue={defaultTab || tabs[0]?.value}>
        <TabsList className="flex-wrap gap-0.5">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <div className="pt-2">{tab.content}</div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
