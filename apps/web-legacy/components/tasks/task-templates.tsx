'use client';

import { useState, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const TEMPLATES_KEY = 'pe_task_templates';

interface TaskTemplate {
  name: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
}

const DEFAULT_TEMPLATES: TaskTemplate[] = [
  {
    name: 'Bug fix',
    title: 'Fix: ',
    description: '## Steps to reproduce\n1. \n\n## Expected behavior\n\n## Actual behavior\n\n## Environment\n- \n',
    priority: 'high',
    status: 'todo',
  },
  {
    name: 'Feature work',
    title: 'Feature: ',
    description: '## Description\n\n## Acceptance criteria\n- [ ] \n\n## Notes\n',
    priority: 'medium',
    status: 'todo',
  },
  {
    name: 'Quick meeting',
    title: 'Meeting: ',
    description: '## Attendees\n\n## Agenda\n1. \n\n## Notes\n\n## Action items\n- [ ] \n',
    priority: 'medium',
    status: 'todo',
  },
];

function getTemplates(): TaskTemplate[] {
  if (typeof window === 'undefined') return DEFAULT_TEMPLATES;
  try {
    const stored = localStorage.getItem(TEMPLATES_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_TEMPLATES;
}

interface TaskTemplatesProps {
  onSelect: (template: TaskTemplate) => void;
}

export function TaskTemplates({ onSelect }: TaskTemplatesProps) {
  const [templates] = useState<TaskTemplate[]>(getTemplates);

  const handleChange = useCallback(
    (value: string) => {
      const template = templates.find((t) => t.name === value);
      if (template) {
        onSelect(template);
        toast.success('Template applied');
      }
    },
    [templates, onSelect]
  );

  if (templates.length === 0) return null;

  return (
    <div className="space-y-2">
      <Label htmlFor="task-template">From template</Label>
      <Select onValueChange={handleChange}>
        <SelectTrigger id="task-template">
          <SelectValue placeholder="Choose a template..." />
        </SelectTrigger>
        <SelectContent>
          {templates.map((t) => (
            <SelectItem key={t.name} value={t.name}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export type { TaskTemplate };
