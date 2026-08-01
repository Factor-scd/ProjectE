'use client';

import { useEffect, useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ItemType = 'task' | 'project' | 'habit';

const labels = {
  task: { title: 'New task', field: 'Task title' },
  project: { title: 'New project', field: 'Project name' },
  habit: { title: 'New habit', field: 'Habit name' },
} as const;

interface Domain {
  id: string;
  name: string;
  color: string;
}

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
  const [domain, setDomain] = useState('');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const copy = labels[type];

  useEffect(() => {
    if (open) {
      fetch('/api/domains?sort=sort_order')
        .then((res) => res.json())
        .then((data) => {
          const items = data.items || [];
          setDomains(items);
          if (items.length > 0 && !domain) {
            setDomain(items[0].id);
          }
        })
        .catch(() => {
          setDomains([]);
        });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

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
            {domains.length > 0 ? (
              <Select value={domain} onValueChange={setDomain}>
                <SelectTrigger id={`${type}-domain`}>
                  <SelectValue placeholder="Select a domain" />
                </SelectTrigger>
                <SelectContent>
                  {domains.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span
                        className="mr-2 inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: d.color }}
                      />
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">
                No domains found. Create one in Settings first.
              </p>
            )}
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !domain}>
              {submitting ? 'Creating...' : `Create ${type}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}