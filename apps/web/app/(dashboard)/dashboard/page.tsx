'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useDashboardStore } from '@/lib/stores/use-dashboard-store';
import { WidgetErrorBoundary } from '@/components/widget-error-boundary';
import { Button } from '@/components/ui/button';

// Lazy load react-grid-layout (client-only, ~45KB)
const ResponsiveGridLayout = dynamic(
  () => import('@/components/dashboard/responsive-grid-layout'),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[200px] animate-pulse rounded-lg border bg-muted/30" />
        ))}
      </div>
    ),
  }
);

// Lazy load individual widgets — each is code-split into its own chunk
const TodayTasksWidget = dynamic(
  () =>
    import('@/components/dashboard/widgets/today-tasks-widget').then((m) => m.TodayTasksWidget),
  {
    ssr: false,
    loading: () => <WidgetSkeleton />,
  }
);

const HabitChecklistWidget = dynamic(
  () =>
    import('@/components/dashboard/widgets/habit-checklist-widget').then(
      (m) => m.HabitChecklistWidget
    ),
  {
    ssr: false,
    loading: () => <WidgetSkeleton />,
  }
);

const WeeklyStatsWidget = dynamic(
  () =>
    import('@/components/dashboard/widgets/weekly-stats-widget').then((m) => m.WeeklyStatsWidget),
  {
    ssr: false,
    loading: () => <WidgetSkeleton />,
  }
);

const ProjectProgressWidget = dynamic(
  () =>
    import('@/components/dashboard/widgets/project-progress-widget').then(
      (m) => m.ProjectProgressWidget
    ),
  {
    ssr: false,
    loading: () => <WidgetSkeleton />,
  }
);

const HabitStreaksWidget = dynamic(
  () =>
    import('@/components/dashboard/widgets/habit-streaks-widget').then((m) => m.HabitStreaksWidget),
  {
    ssr: false,
    loading: () => <WidgetSkeleton />,
  }
);

const CalendarMiniWidget = dynamic(
  () =>
    import('@/components/dashboard/widgets/calendar-mini-widget').then((m) => m.CalendarMiniWidget),
  {
    ssr: false,
    loading: () => <WidgetSkeleton />,
  }
);

const QuickAddWidget = dynamic(
  () =>
    import('@/components/dashboard/widgets/quick-add-widget').then((m) => m.QuickAddWidget),
  {
    ssr: false,
    loading: () => <WidgetSkeleton />,
  }
);

const RecentActivityWidget = dynamic(
  () =>
    import('@/components/dashboard/widgets/recent-activity-widget').then(
      (m) => m.RecentActivityWidget
    ),
  {
    ssr: false,
    loading: () => <WidgetSkeleton />,
  }
);

function WidgetSkeleton() {
  return (
    <div className="h-full animate-pulse rounded-lg border bg-muted/30 p-4">
      <div className="mb-3 h-4 w-24 rounded bg-muted/50" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-muted/50" />
        <div className="h-3 w-3/4 rounded bg-muted/50" />
        <div className="h-3 w-1/2 rounded bg-muted/50" />
      </div>
    </div>
  );
}

const widgetComponents: Record<string, React.ComponentType> = {
  'today-tasks': TodayTasksWidget,
  'habit-checklist': HabitChecklistWidget,
  'weekly-stats': WeeklyStatsWidget,
  'project-progress': ProjectProgressWidget,
  'habit-streaks': HabitStreaksWidget,
  'calendar-mini': CalendarMiniWidget,
  'quick-add': QuickAddWidget,
  'recent-activity': RecentActivityWidget,
};

export default function DashboardPage() {
  const { widgets, setWidgets } = useDashboardStore();
  const [layoutAnnouncement, setLayoutAnnouncement] = React.useState('');

  const layout = widgets.map((w) => ({
    i: w.id,
    x: w.x,
    y: w.y,
    w: w.w,
    h: w.h,
  }));

  function handleLayoutChange(newLayout: ReadonlyArray<{ i: string; x: number; y: number; w: number; h: number }>) {
    const updated = widgets.map((w) => {
      const layoutItem = newLayout.find((l) => l.i === w.id);
      if (layoutItem) {
        return {
          ...w,
          x: layoutItem.x,
          y: layoutItem.y,
          w: layoutItem.w,
          h: layoutItem.h,
        };
      }
      return w;
    });
    setWidgets(updated);
  }

  function moveWidget(id: string, direction: -1 | 1) {
    const ordered = [...widgets].sort((a, b) => a.y - b.y || a.x - b.x);
    const index = ordered.findIndex((widget) => widget.id === id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;

    const current = ordered[index];
    const target = ordered[targetIndex];
    setWidgets(widgets.map((widget) => {
      if (widget.id === current.id) return { ...widget, x: target.x, y: target.y };
      if (widget.id === target.id) return { ...widget, x: current.x, y: current.y };
      return widget;
    }));
    setLayoutAnnouncement(`${current.type} moved ${direction < 0 ? 'earlier' : 'later'} on the dashboard.`);
  }

  function resizeWidget(id: string, direction: -1 | 1) {
    const widget = widgets.find((item) => item.id === id);
    if (!widget) return;
    const width = Math.max(2, Math.min(12, widget.w + direction));
    if (width === widget.w) return;
    setWidgets(widgets.map((item) => item.id === id ? { ...item, w: width } : item));
    setLayoutAnnouncement(`${widget.type} is now ${width} columns wide.`);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Your day, at a glance.</p>
      </div>

      <details className="mb-4 rounded-lg border bg-card p-3">
        <summary className="cursor-pointer text-sm font-medium">Customize dashboard layout</summary>
        <p className="mt-2 text-sm text-muted-foreground">
          Use these controls to reorder or resize widgets without dragging.
        </p>
        <div className="mt-3 space-y-2">
          {[...widgets].sort((a, b) => a.y - b.y || a.x - b.x).map((widget, index, ordered) => (
            <div key={widget.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2">
              <span className="text-sm">{widget.type}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => moveWidget(widget.id, -1)} disabled={index === 0}>
                  Move earlier
                </Button>
                <Button variant="outline" size="sm" onClick={() => moveWidget(widget.id, 1)} disabled={index === ordered.length - 1}>
                  Move later
                </Button>
                <Button variant="outline" size="sm" onClick={() => resizeWidget(widget.id, -1)} disabled={widget.w <= 2}>
                  Narrower
                </Button>
                <Button variant="outline" size="sm" onClick={() => resizeWidget(widget.id, 1)} disabled={widget.w >= 12}>
                  Wider
                </Button>
              </div>
            </div>
          ))}
        </div>
      </details>
      <p className="sr-only" aria-live="polite">{layoutAnnouncement}</p>

      <ResponsiveGridLayout layout={layout} onLayoutChange={handleLayoutChange}>
        {widgets.map((widget) => {
          const WidgetComponent = widgetComponents[widget.id];
          if (!WidgetComponent) return null;

          return (
            <div key={widget.id}>
              <WidgetErrorBoundary widgetName={widget.type}>
                <div className="h-full rounded-lg border bg-card p-4 shadow-sm">
                  <div className="widget-drag-handle">
                    <Suspense fallback={<WidgetSkeleton />}>
                      <WidgetComponent />
                    </Suspense>
                  </div>
                </div>
              </WidgetErrorBoundary>
            </div>
          );
        })}
      </ResponsiveGridLayout>
    </div>
  );
}
