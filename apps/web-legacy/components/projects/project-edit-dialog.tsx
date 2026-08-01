'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
  domainId: string;
  color: string | null;
  icon: string | null;
  targetDate: string | null;
}

interface ProjectEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  domainId: string;
  onUpdated: () => void;
}

export function ProjectEditDialog({
  open,
  onOpenChange,
  project,
  domainId,
  onUpdated,
}: ProjectEditDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'paused' | 'completed' | 'archived'>('active');
  const [color, setColor] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (open && project) {
      setName(project.name);
      setDescription(project.description || '');
      setStatus(project.status);
      setColor(project.color || '');
      setTargetDate(project.targetDate ? project.targetDate.split('T')[0] : '');
      setError('');
    }
  }, [open, project]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!domainId) {
      setError('No domain selected');
      return;
    }
    setSubmitting(true);
    setError('');

    const body: Record<string, unknown> = { name, status };
    if (description) body.description = description;
    if (color) body.color = color;
    if (targetDate) body.targetDate = new Date(targetDate).toISOString();

    try {
      const response = await fetch(`/api/domains/${domainId}/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Unable to update project');
      }

      toast.success('Project updated');
      onOpenChange(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update project');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      const response = await fetch(`/api/domains/${domainId}/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Unable to archive project');
      }

      toast.success('Project archived');
      setArchiveOpen(false);
      onOpenChange(false);
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to archive project');
    } finally {
      setArchiving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update your project details.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="edit-project-name">Name *</Label>
              <Input
                id="edit-project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name"
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-project-description">Description</Label>
              <Textarea
                id="edit-project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-project-status">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                  <SelectTrigger id="edit-project-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-project-color">Color</Label>
                <Input
                  id="edit-project-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-project-target-date">Target date</Label>
              <Input
                id="edit-project-target-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

            <DialogFooter className="flex items-center justify-between sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setArchiveOpen(true)}
              >
                Archive
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !name || !domainId}>
                  {submitting ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive &quot;{project.name}&quot;? It will be hidden from the active list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={archiving}>
              {archiving ? 'Archiving...' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
