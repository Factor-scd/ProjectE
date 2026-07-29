'use client';

import { useMemo } from 'react';

interface Section {
  id: string;
  name: string;
  kind: 'section' | 'milestone';
  status: 'planned' | 'in_progress' | 'complete';
  targetDate: string | null;
  sortOrder: number;
}

interface ProjectTimelineProps {
  sections: Section[];
  projectTargetDate: string | null;
}

const statusColors: Record<string, string> = {
  planned: 'bg-gray-200 dark:bg-gray-700',
  in_progress: 'bg-blue-400 dark:bg-blue-600',
  complete: 'bg-green-400 dark:bg-green-600',
};

const kindBadge: Record<string, string> = {
  section: 'bg-muted text-muted-foreground',
  milestone: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
};

export function ProjectTimeline({ sections, projectTargetDate }: ProjectTimelineProps) {
  const { startDate, totalDays } = useMemo(() => {
    if (sections.length === 0) return { startDate: new Date(), totalDays: 30 };

    const dates = sections
      .filter((s) => s.targetDate)
      .map((s) => new Date(s.targetDate!));

    if (projectTargetDate) dates.push(new Date(projectTargetDate));

    if (dates.length === 0) {
      // No dates at all — show a default 30-day window
      const now = new Date();
      return { startDate: now, totalDays: 30 };
    }

    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    const diff = Math.max((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24), 14);
    return { startDate: minDate, totalDays: Math.ceil(diff) };
  }, [sections, projectTargetDate]);

  if (sections.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="mb-3 text-sm font-semibold">Timeline</h3>
      <div className="rounded-lg border bg-card p-4">
        {/* Header row */}
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-40 shrink-0">Section</span>
          <div className="relative flex-1 h-4">
            <div className="absolute inset-0 flex">
              {Array.from({ length: Math.min(totalDays, 60) }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 border-r border-border/30"
                  style={i % 7 === 0 ? { borderRightWidth: 2 } : {}}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Section rows */}
        <div className="space-y-2">
          {sections.map((section) => {
            if (!section.targetDate) return null;

            const sectionDate = new Date(section.targetDate);
            const dayOffset = Math.max(
              0,
              Math.round((sectionDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
            );
            const barWidth = Math.max(8, Math.min(100, (1 / Math.max(totalDays, 1)) * 100));

            return (
              <div key={section.id} className="flex items-center gap-2">
                <div className="flex w-40 shrink-0 items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      kindBadge[section.kind] || kindBadge.section
                    }`}
                  >
                    {section.kind === 'milestone' ? 'M' : 'S'}
                  </span>
                  <span className="truncate text-sm">{section.name}</span>
                </div>
                <div className="relative flex-1 h-6">
                  <div
                    className={`absolute top-1 h-4 rounded ${
                      statusColors[section.status] || statusColors.planned
                    }`}
                    style={{
                      left: `${(dayOffset / Math.max(totalDays, 1)) * 100}%`,
                      width: `${barWidth}%`,
                      minWidth: 8,
                    }}
                    title={`${section.name} — ${section.status} — ${sectionDate.toLocaleDateString()}`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Project target date marker */}
        {projectTargetDate && (
          <div className="mt-3 flex items-center gap-2 border-t pt-2 text-xs text-muted-foreground">
            <span className="w-40 shrink-0">Target date</span>
            <span>{new Date(projectTargetDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
