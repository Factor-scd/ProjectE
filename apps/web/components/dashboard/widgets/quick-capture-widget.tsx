'use client';

import { useState } from 'react';
import { Plus, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';

export function QuickCaptureWidget() {
  const [type, setType] = useState('task');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      const endpoint = type === 'task' ? '/api/tasks'
        : type === 'habit' ? '/api/habits'
        : '/api/notes';

      const body: Record<string, unknown> = { title: title.trim() };
      if (type === 'task') {
        body.status = 'todo';
        body.priority = 'medium';
      }
      if (type === 'habit') {
        body.name = title.trim();
        delete body.title;
        body.frequency = 'daily';
        body.difficulty = 'medium';
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setTitle('');
        router.refresh();
      }
    } catch (err) {
      console.error('Quick capture failed:', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="h-full border-0 shadow-none">
      <CardHeader className="p-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Quick Capture
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="task">Task</SelectItem>
              <SelectItem value="habit">Habit</SelectItem>
              <SelectItem value="note">Note</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Quick add..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={submitting || !title.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
