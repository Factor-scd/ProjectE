'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Rocket, ListTodo, Flame } from 'lucide-react';

const ONBOARDED_KEY = 'pe_onboarded';

interface OnboardingFlowProps {
  onComplete?: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [domainName, setDomainName] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onboarded = localStorage.getItem(ONBOARDED_KEY);
    if (!onboarded) {
      setOpen(true);
    }
  }, []);

  function handleDismiss() {
    localStorage.setItem(ONBOARDED_KEY, 'true');
    setOpen(false);
    onComplete?.();
  }

  async function handleCreateDomain() {
    if (!domainName.trim()) {
      toast.error('Please enter a domain name');
      return;
    }
    try {
      const res = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: domainName.trim() }),
      });
      if (!res.ok) throw new Error('Failed to create domain');
      toast.success('Domain created!');
      setStep(1);
    } catch {
      toast.error('Failed to create domain');
    }
  }

  const steps = [
    {
      title: 'Pick your primary domain',
      description: 'A domain is your workspace — a container for tasks, habits, and projects.',
      icon: <Rocket className="h-8 w-8 text-primary" />,
      content: (
        <div className="space-y-3">
          <Label htmlFor="domain-name">Domain name</Label>
          <Input
            id="domain-name"
            value={domainName}
            onChange={(e) => setDomainName(e.target.value)}
            placeholder="e.g. Personal, Work, Side Project"
            autoFocus
          />
          <Button onClick={handleCreateDomain} className="w-full">
            Create domain
          </Button>
        </div>
      ),
    },
    {
      title: 'Create your first task',
      description: 'Tasks are the building blocks of your workflow. Create one to get started.',
      icon: <ListTodo className="h-8 w-8 text-primary" />,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Use the <kbd className="rounded border bg-muted px-1 font-mono text-xs">+</kbd> button in the top bar or press{' '}
            <kbd className="rounded border bg-muted px-1 font-mono text-xs">C</kbd> on the Tasks page to create a new task.
          </p>
          <Button onClick={() => setStep(2)} className="w-full">
            Got it, next step
          </Button>
        </div>
      ),
    },
    {
      title: 'Add a habit',
      description: 'Build streaks and track progress on things you do regularly.',
      icon: <Flame className="h-8 w-8 text-primary" />,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Head to the Habits page and click <strong>New habit</strong> to start tracking something daily or weekly.
          </p>
          <Button onClick={handleDismiss} className="w-full">
            Done — start using Project E
          </Button>
        </div>
      ),
    },
  ];

  const current = steps[step];

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <SheetContent side="bottom" className="sm:max-w-md sm:mx-auto sm:rounded-t-xl">
        <SheetHeader className="mb-4">
          <div className="flex items-center gap-3">
            {current.icon}
            <div>
              <SheetTitle>{current.title}</SheetTitle>
              <SheetDescription>{current.description}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {current.content}

        <SheetFooter className="mt-6 flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-6 rounded-full transition-colors ${
                  i === step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            Skip onboarding
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
