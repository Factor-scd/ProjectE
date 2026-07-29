'use client';

import React, { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useDashboardStore } from '@/lib/stores/use-dashboard-store';
import { WidgetErrorBoundary } from '@/components/widget-error-boundary';
import { Button } from '@/components/ui/button';
import { Settings2, LayoutGrid } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

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

// Lazy load individual widgets
const TodayTasksWidget = dynamic(() => import('@/components/dashboard/widgets/today-tasks-widget').then((m) => m.TodayTasksWidget), { ssr: false, loading: () => <WidgetSkeleton /> });
const HabitChecklistWidget = dynamic(() => import('@/components/dashboard/widgets/habit-checklist-widget').then((m) => m.HabitChecklistWidget), { ssr: false, loading: () => <WidgetSkeleton /> });
const WeeklyStatsWidget = dynamic(() => import('@/components/dashboard/widgets/weekly-stats-widget').then((m) => m.WeeklyStatsWidget), { ssr: false, loading: () => <WidgetSkeleton /> });
const ProjectProgressWidget = dynamic(() => import('@/components/dashboard/widgets/project-progress-widget').then((m) => m.ProjectProgressWidget), { ssr: false, loading: () => <WidgetSkeleton /> });
const UpcomingCalendarWidget = dynamic(() => import('@/components/dashboard/widgets/upcoming-calendar-widget').then((m) => m.UpcomingCalendarWidget), { ssr: false, loading: () => <WidgetSkeleton /> });
const RecentNotesWidget = dynamic(() => import('@/components/dashboard/widgets/recent-notes-widget').then((m) => m.RecentNotesWidget), { ssr: false, loading: () => <WidgetSkeleton /> });
const ActivityFeedWidget = dynamic(() => import('@/components/dashboard/widgets/activity-feed-widget').then((m) => m.ActivityFeedWidget), { ssr: false, loading: () => <WidgetSkeleton /> });
const QuickCaptureWidget = dynamic(() => import('@/components/dashboard/widgets/quick-capture-widget').then((m) => m.QuickCaptureWidget), { ssr: false, loading: () => <WidgetSkeleton /> });

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
  'upcoming-calendar': UpcomingCalendarWidget,
  'recent-notes': RecentNotesWidget,
  'activity-feed': ActivityFeedWidget,
  'quick-capture': QuickCaptureWidget,
};

const widgetLabels: Record<string, string> = {
  'today-tasks': "Today's Tasks",
  'habit-checklist': 'Habit Checklist',
  'weekly-stats': 'Weekly Stats',
  'project-progress': 'Project Progress',
  'upcoming-calendar': 'Upcoming Calendar',
  'recent-notes': 'Recent Notes',
  'activity-feed': 'Activity Feed',
  'quick-capture': 'Quick Capture',
};

export default function DashboardPage() {
  const { widgets, setWidgets, addWidget, removeWidget } = useDashboardStore();
  const [layoutAnnouncement, setLayoutAnnouncement] = React.useState('');
  const [editMode, setEditMode] = React.useState(false);
  const [showConfig, setShowConfig] = React.useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const domainFilter = searchParams.get('domain');

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
        return { ...w, x: layoutItem.x, y: layoutItem.y, w: layoutItem.w, h: layoutItem.h };
      }
      return w;
    });
    setWidgets(updated);
  }

  const availableWidgets = Object.keys(widgetComponents).filter((id) => !widgets.find((w) => w.id === id));

  function addNewWidget(widgetId: string) {
    addWidget({
      id: widgetId,
      type: widgetLabels[widgetId] || widgetId,
      x: 0,
      y: widgets.length,
      w: 4,
      h: 3,
      visible: true,
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Your day, at a glance.{domainFilter ? " (Filtered: " + domainFilter + ")" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={editMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setEditMode(!editMode)}
          >
            <LayoutGrid className="mr-1 h-4 w-4" />
            {editMode ? 'Done' : 'Edit'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
          >
            <Settings2 className="mr-1 h-4 w-4" />
            Configure
          </Button>
        </div>
      </div>

      {/* Widget configuration panel */}
      {showConfig && (
        <div className="mb-6 rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Add Widgets</h3>
          <div className="flex flex-wrap gap-2">
            {availableWidgets.length === 0 ? (
              <p className="text-sm text-muted-foreground">All widgets are already on your dashboard.</p>
            ) : (
              availableWidgets.map((id) => (
                <Button
                  key={id}
                  variant="outline"
                  size="sm"
                  onClick={() => addNewWidget(id)}
                >
                  + {widgetLabels[id] || id}
                </Button>
              ))
            )}
          </div>
          <div className="mt-4">
            <h3 className="mb-3 text-sm font-semibold">Active Widgets</h3>
            <div className="space-y-2">
              {widgets.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                  <span className="text-sm">{widgetLabels[w.id] || w.type}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => removeWidget(w.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="sr-only" aria-live="polite">{layoutAnnouncement}</p>

      <ResponsiveGridLayout layout={layout} onLayoutChange={handleLayoutChange} isDraggable={editMode} isResizable={editMode}>
        {widgets.map((widget) => {
          const WidgetComponent = widgetComponents[widget.id];
          if (!WidgetComponent) return null;

          return (
            <div key={widget.id}>
              <WidgetErrorBoundary widgetName={widget.type}>
                <div className="h-full rounded-lg border bg-card p-4 shadow-sm">
                  <div className={editMode ? 'widget-drag-handle' : ''}>
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
