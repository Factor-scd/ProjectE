'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useDashboardStore } from '@/lib/stores/use-dashboard-store';
import { WidgetErrorBoundary } from '@/components/widget-error-boundary';

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

  const layout = widgets.map((w) => ({
    i: w.id,
    x: w.x,
    y: w.y,
    w: w.w,
    h: w.h,
  }));

  function handleLayoutChange(newLayout: { i: string; x: number; y: number; w: number; h: number }[]) {
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Your day, at a glance.</p>
      </div>

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
