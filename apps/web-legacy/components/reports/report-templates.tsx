'use client';

import { Calendar, Target, TrendingUp, Clock, FileBarChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Template {
  id: string;
  name: string;
  description: string;
  type: 'weekly' | 'monthly' | 'project' | 'habit' | 'custom';
  icon: React.ComponentType<{ className?: string }>;
  content: string;
}

const templates: Template[] = [
  {
    id: 'weekly',
    name: 'Weekly Summary',
    description: 'Review your tasks, habits, and time from the past week',
    type: 'weekly',
    icon: Calendar,
    content: `
      <h1>Weekly Summary</h1>
      <h2>Overview</h2>
      <p>Week of [DATE_RANGE]</p>
      
      <h2>Tasks Completed</h2>
      <ul>
        <li>[TASK_LIST]</li>
      </ul>
      
      <h2>Habits Tracked</h2>
      <ul>
        <li>[HABIT_SUMMARY]</li>
      </ul>
      
      <h2>Time Logged</h2>
      <p>Total: [TIME_TOTAL]</p>
      
      <h2>Reflections</h2>
      <p>What went well this week?</p>
      <p>What could be improved?</p>
      <p>Goals for next week:</p>
    `,
  },
  {
    id: 'monthly',
    name: 'Monthly Review',
    description: 'Comprehensive review of the past month',
    type: 'monthly',
    icon: Calendar,
    content: `
      <h1>Monthly Review</h1>
      <h2>Month of [DATE_RANGE]</h2>
      
      <h2>Key Achievements</h2>
      <ul>
        <li>[ACHIEVEMENTS]</li>
      </ul>
      
      <h2>Project Progress</h2>
      <ul>
        <li>[PROJECT_SUMMARY]</li>
      </ul>
      
      <h2>Habit Consistency</h2>
      <p>[HABIT_ANALYSIS]</p>
      
      <h2>Time Distribution</h2>
      <p>[TIME_BREAKDOWN]</p>
      
      <h2>Lessons Learned</h2>
      <p>What worked well?</p>
      <p>What didn't work?</p>
      
      <h2>Next Month's Focus</h2>
      <p>Priorities:</p>
      <p>Goals:</p>
    `,
  },
  {
    id: 'project',
    name: 'Project Health',
    description: 'Status and progress report for a specific project',
    type: 'project',
    icon: Target,
    content: `
      <h1>Project Health Report</h1>
      <h2>[PROJECT_NAME]</h2>
      
      <h2>Status Overview</h2>
      <p>Progress: [PROGRESS]%</p>
      <p>Tasks: [COMPLETED] / [TOTAL]</p>
      <p>Due: [DUE_DATE]</p>
      
      <h2>Milestones</h2>
      <ul>
        <li>[MILESTONE_LIST]</li>
      </ul>
      
      <h2>Recent Activity</h2>
      <ul>
        <li>[RECENT_TASKS]</li>
      </ul>
      
      <h2>Risks & Blockers</h2>
      <p>[RISKS]</p>
      
      <h2>Next Steps</h2>
      <ul>
        <li>[NEXT_STEPS]</li>
      </ul>
    `,
  },
  {
    id: 'habit',
    name: 'Habit Analysis',
    description: 'Deep dive into habit performance and trends',
    type: 'habit',
    icon: TrendingUp,
    content: `
      <h1>Habit Analysis</h1>
      <h2>Period: [DATE_RANGE]</h2>
      
      <h2>Overall Performance</h2>
      <p>Completion rate: [COMPLETION_RATE]%</p>
      <p>Active streaks: [STREAK_COUNT]</p>
      
      <h2>Top Performing Habits</h2>
      <ol>
        <li>[TOP_HABITS]</li>
      </ol>
      
      <h2>Habits Needing Attention</h2>
      <ul>
        <li>[AT_RISK_HABITS]</li>
      </ul>
      
      <h2>Trends & Patterns</h2>
      <p>[TREND_ANALYSIS]</p>
      
      <h2>Recommendations</h2>
      <ul>
        <li>[RECOMMENDATIONS]</li>
      </ul>
    `,
  },
  {
    id: 'time',
    name: 'Time Audit',
    description: 'Breakdown of where your time went',
    type: 'custom',
    icon: Clock,
    content: `
      <h1>Time Audit</h1>
      <h2>Period: [DATE_RANGE]</h2>
      
      <h2>Total Time Tracked</h2>
      <p>[TOTAL_TIME]</p>
      
      <h2>By Domain</h2>
      <ul>
        <li>[DOMAIN_BREAKDOWN]</li>
      </ul>
      
      <h2>By Project</h2>
      <ul>
        <li>[PROJECT_BREAKDOWN]</li>
      </ul>
      
      <h2>By Category</h2>
      <ul>
        <li>[CATEGORY_BREAKDOWN]</li>
      </ul>
      
      <h2>Insights</h2>
      <p>Where did most time go?</p>
      <p>Was time aligned with priorities?</p>
      <p>Adjustments for next period:</p>
    `,
  },
];

interface ReportTemplatesProps {
  onSelect: (template: Template) => void;
  onCancel: () => void;
}

export function ReportTemplates({ onSelect, onCancel }: ReportTemplatesProps) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Choose a Template</h1>
          <p className="mt-1 text-muted-foreground">
            Start with a template or create from scratch
          </p>
        </div>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" role="list">
        {templates.map((template) => (
          <Card
            key={template.id}
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => onSelect(template)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(template);
              }
            }}
            tabIndex={0}
            role="listitem"
            aria-label={`Use template: ${template.name}`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <template.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{template.description}</p>
            </CardContent>
          </Card>
        ))}

        {/* Custom template */}
        <Card
          className="cursor-pointer border-dashed transition-shadow hover:shadow-md"
          onClick={() =>
            onSelect({
              id: 'custom',
              name: 'Custom Report',
              description: 'Start with a blank report',
              type: 'custom',
              icon: FileBarChart,
              content: '<h1>Custom Report</h1><p>Start writing...</p>',
            })
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect({
                id: 'custom',
                name: 'Custom Report',
                description: 'Start with a blank report',
                type: 'custom',
                icon: FileBarChart,
                content: '<h1>Custom Report</h1><p>Start writing...</p>',
              });
            }
          }}
          tabIndex={0}
          role="listitem"
          aria-label="Start with a blank custom report"
        >
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-muted p-2">
                <FileBarChart className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">Custom Report</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Start with a blank report</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
