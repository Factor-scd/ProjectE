import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WidgetConfig {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
}

interface DashboardState {
  widgets: WidgetConfig[];

  // Actions
  setWidgets: (widgets: WidgetConfig[]) => void;
  updateWidget: (id: string, updates: Partial<WidgetConfig>) => void;
  addWidget: (widget: WidgetConfig) => void;
  removeWidget: (id: string) => void;
  resetLayout: () => void;
}

const defaultWidgets: WidgetConfig[] = [
  { id: 'today-tasks', type: 'TodayTasks', x: 0, y: 0, w: 6, h: 4, visible: true },
  { id: 'habit-checklist', type: 'HabitChecklist', x: 6, y: 0, w: 3, h: 4, visible: true },
  { id: 'weekly-stats', type: 'WeeklyStats', x: 9, y: 0, w: 3, h: 4, visible: true },
  { id: 'project-progress', type: 'ProjectProgress', x: 0, y: 4, w: 4, h: 3, visible: true },
  { id: 'habit-streaks', type: 'HabitStreaks', x: 4, y: 4, w: 4, h: 3, visible: true },
  { id: 'calendar-mini', type: 'CalendarMini', x: 8, y: 4, w: 4, h: 3, visible: true },
  { id: 'quick-add', type: 'QuickAdd', x: 0, y: 7, w: 3, h: 3, visible: true },
  { id: 'recent-activity', type: 'RecentActivity', x: 3, y: 7, w: 9, h: 3, visible: true },
];

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      widgets: defaultWidgets,

      setWidgets: (widgets) => set({ widgets }),
      updateWidget: (id, updates) =>
        set((state) => ({
          widgets: state.widgets.map((w) =>
            w.id === id ? { ...w, ...updates } : w
          ),
        })),
      addWidget: (widget) =>
        set((state) => ({
          widgets: [...state.widgets, widget],
        })),
      removeWidget: (id) =>
        set((state) => ({
          widgets: state.widgets.filter((w) => w.id !== id),
        })),
      resetLayout: () => set({ widgets: defaultWidgets }),
    }),
    {
      name: 'project-e-dashboard',
    }
  )
);
