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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface Section {
  id: string;
  name: string;
  projectId: string;
  kind: 'section' | 'milestone';
  status: 'planned' | 'in_progress' | 'complete';
  targetDate: string | null;
  sortOrder: number;
}

interface SectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  domainId: string;
  onCreated: () => void;
  existingSection?: Section;
}

export function SectionDialog({
  open,
  onOpenChange,
  projectId,
  domainId,
  onCreated,
  existingSection,
}: SectionDialogProps) {
  const isEdit = !!existingSection;
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'section' | 'milestone'>('section');
  const [status, setStatus] = useState<'planned' | 'in_progress' | 'complete'>('planned');
  const [targetDate, setTargetDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      if (existingSection) {
        setName(existingSection.name);
        setKind(existingSection.kind);
        setStatus(existingSection.status);
        setTargetDate(existingSection.targetDate ? existingSection.targetDate.split('T')[0] : '');
      } else {
        setName('');
        setKind('section');
        setStatus('planned');
        setTargetDate('');
      }
      setError('');
    }
  }, [open, existingSection]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError('');

    const body: Record<string, unknown> = { name, kind, status };
    if (targetDate) body.targetDate = new Date(targetDate).toISOString();

    try {
      let response: Response;

      if (isEdit && existingSection) {
        response = await fetch(`/api/domains/${domainId}/projects/${projectId}/sections/${existingSection.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        response = await fetch(`/api/domains/${domainId}/projects/${projectId}/sections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || `Unable to ${isEdit ? 'update' : 'create'} section`);
      }

      toast.success(isEdit ? 'Section updated' : 'Section created');
      onOpenChange(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to ${isEdit ? 'update' : 'create'} section`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!existingSection) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/domains/${domainId}/projects/${projectId}/sections/${existingSection.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Unable to delete section');
      }

      toast.success('Section deleted');
      setDeleteOpen(false);
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to delete section');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Section' : 'New Section'}</DialogTitle>
            <DialogDescription>
              {isEdit ? 'Update this section or milestone.' : 'Add a section or milestone to organize tasks.'}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="section-name">Name *</Label>
              <Input
                id="section-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Backend, Design, Launch"
                autoFocus
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="section-kind">Kind</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as any)}>
                  <SelectTrigger id="section-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="section">Section</SelectItem>
                    <SelectItem value="milestone">Milestone</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="section-status">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                  <SelectTrigger id="section-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="section-target-date">Target date</Label>
              <Input
                id="section-target-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

            <DialogFooter className="flex items-center justify-between sm:justify-between">
              {isEdit && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete
                </Button>
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !name}>
                  {submitting ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save' : 'Create Section')}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{existingSection?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
