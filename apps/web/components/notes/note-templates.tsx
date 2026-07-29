'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { FileText, NotebookText, BrainCircuit } from 'lucide-react';

const TEMPLATES_KEY = 'pe_note_templates';

interface NoteTemplate {
  name: string;
  icon: string;
  content: string;
}

const DEFAULT_TEMPLATES: NoteTemplate[] = [
  {
    name: 'Meeting notes',
    icon: 'FileText',
    content: '<h2>Meeting: [Title]</h2><p><strong>Date:</strong> [Date]</p><p><strong>Attendees:</strong></p><ul><li></li></ul><h3>Agenda</h3><ol><li></li></ol><h3>Notes</h3><p></p><h3>Action Items</h3><ul><li></li></ul>',
  },
  {
    name: 'Daily journal',
    icon: 'NotebookText',
    content: '<h2>[Date]</h2><h3>What I did today</h3><p></p><h3>What I learned</h3><p></p><h3>What I\'m grateful for</h3><ul><li></li></ul>',
  },
  {
    name: 'Brain dump',
    icon: 'BrainCircuit',
    content: '<h2>Brain Dump — [Date]</h2><p>Everything on my mind right now:</p><ul><li></li></ul><h3>Priorities</h3><ol><li></li></ol>',
  },
];

function getTemplates(): NoteTemplate[] {
  if (typeof window === 'undefined') return DEFAULT_TEMPLATES;
  try {
    const stored = localStorage.getItem(TEMPLATES_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_TEMPLATES;
}

interface NoteTemplatesProps {
  onCreateFromTemplate: (content: string) => void;
}

export function NoteTemplates({ onCreateFromTemplate }: NoteTemplatesProps) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<NoteTemplate[]>(getTemplates);

  const handleSelect = useCallback(
    (template: NoteTemplate) => {
      const content = template.content
        .replace(/\[Date\]/g, new Date().toLocaleDateString())
        .replace(/\[Title\]/g, template.name);
      onCreateFromTemplate(content);
      setOpen(false);
      toast.success('Note created from template');
    },
    [onCreateFromTemplate]
  );

  const iconMap: Record<string, React.ReactNode> = {
    FileText: <FileText className="h-5 w-5" />,
    NotebookText: <NotebookText className="h-5 w-5" />,
    BrainCircuit: <BrainCircuit className="h-5 w-5" />,
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileText className="mr-2 h-4 w-4" />
        + From template
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose a template</DialogTitle>
            <DialogDescription>
              Start with a pre-formatted note template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {templates.map((template) => (
              <button
                key={template.name}
                onClick={() => handleSelect(template)}
                className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {iconMap[template.icon] || <FileText className="h-5 w-5" />}
                </span>
                <div>
                  <p className="text-sm font-medium">{template.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {template.name === 'Meeting notes'
                      ? 'Structured meeting notes with agenda and action items'
                      : template.name === 'Daily journal'
                        ? 'Daily reflection with accomplishments and learnings'
                        : 'Free-form thought capture'}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <DialogFooter className="text-xs text-muted-foreground">
            Templates are stored locally in your browser.
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
