'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ItemType = 'task' | 'project' | 'habit';

const labels = {
  task: { title: 'New task', field: 'Task title' },
  project: { title: 'New project', field: 'Project name' },
  habit: { title: 'New habit', field: 'Habit name' },
} as const;

export function CreateItemDialog({
  type,
  open,
  onOpenChange,
  onCreated,
}: {
  type: ItemType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('General');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const copy = labels[type];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const body =
      type === 'task'
        ? { title: name, domain, status: 'todo', priority: 'medium', tags: [] }
        : type === 'project'
          ? { name, domain, status: 'active', tags: [] }
          : {
              name,
              domain,
              frequency: 'daily',
              difficulty: 'medium',
              completion_mode: 'quick',
              goal_per_period: 1,
              active: true,
              tags: [],
            };

    try {
      const response = await fetch(`/api/${type === 'task' ? 'tasks' : `${type}s`}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Unable to create item');
      }

      setName('');
      onOpenChange(false);
      onCreated();
    } catch {
      setError(`Unable to create this ${type}. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>Give it a name and choose where it belongs.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor={`${type}-name`}>{copy.field}</Label>
            <Input
              id={`${type}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${type}-domain`}>Domain</Label>
            <Input
              id={`${type}-domain`}
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : `Create ${type}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
