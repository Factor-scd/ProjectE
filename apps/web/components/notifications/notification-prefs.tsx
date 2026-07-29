'use client';

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const STORAGE_KEY = 'pe_notification_prefs';

const defaultPrefs: Record<string, boolean> = {
  task_created: true,
  task_completed: true,
  habit_logged: true,
  comment_added: true,
};

const prefLabels: Record<string, string> = {
  task_created: 'Task created',
  task_completed: 'Task completed',
  habit_logged: 'Habit logged',
  comment_added: 'Comment added',
};

export function NotificationPrefs() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(defaultPrefs);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPrefs({ ...defaultPrefs, ...JSON.parse(stored) });
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  function toggle(key: string) {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Storage may be full
    }
  }

  return (
    <div className="space-y-3">
      {Object.entries(prefLabels).map(([key, label]) => (
        <div key={key} className="flex items-center justify-between">
          <Label htmlFor={`notif-${key}`} className="text-sm font-normal">
            {label}
          </Label>
          <Switch
            id={`notif-${key}`}
            checked={prefs[key]}
            onCheckedChange={() => toggle(key)}
            aria-label={`Toggle ${label}`}
          />
        </div>
      ))}
    </div>
  );
}
