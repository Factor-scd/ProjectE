'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bot, Sparkles, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface Agent {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'disabled';
  permission_tier: string;
}

interface DispatchPanelProps {
  /** Optional trigger label override */
  triggerLabel?: string;
  /** Optional variant for the trigger button */
  triggerVariant?: 'default' | 'outline' | 'ghost';
  /** Optional class name for the trigger button */
  triggerClassName?: string;
}

export function DispatchPanel({
  triggerLabel = 'Ask AI',
  triggerVariant = 'default',
  triggerClassName,
}: DispatchPanelProps) {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [entityRef, setEntityRef] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);

  const fetchAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      const activeAgents = (data.items || []).filter(
        (a: Agent) => a.status === 'active'
      );
      setAgents(activeAgents);
      if (activeAgents.length > 0 && !selectedAgentId) {
        setSelectedAgentId(activeAgents[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setLoadingAgents(false);
    }
  }, [selectedAgentId]);

  useEffect(() => {
    if (open) {
      fetchAgents();
    }
  }, [open, fetchAgents]);

  async function handleDispatch() {
    if (!selectedAgentId || !prompt.trim()) {
      toast.error('Please select an agent and enter a prompt');
      return;
    }

    setDispatching(true);
    try {
      const body: Record<string, unknown> = {
        agent_id: selectedAgentId,
        task_type: 'custom',
        input: { prompt: prompt.trim() },
      };

      if (entityRef.trim()) {
        // Parse entity reference: "type:id" or just a free-form reference
        body.entity_type = 'reference';
        body.entity_id = entityRef.trim();
      }

      const res = await fetch('/api/agent-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('Failed to dispatch task:', text);
        toast.error('Failed to dispatch task');
        return;
      }

      toast.success('Task dispatched — see Agent Activity for results');
      setPrompt('');
      setEntityRef('');
      setOpen(false);
    } catch (err) {
      console.error('Failed to dispatch task:', err);
      toast.error('Failed to dispatch task');
    } finally {
      setDispatching(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant={triggerVariant}
          className={triggerClassName}
          aria-label={triggerLabel}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Dispatch AI Agent
          </SheetTitle>
          <SheetDescription>
            Send a task to an AI agent and view results in Agent Activity.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Agent selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Agent</label>
            {loadingAgents ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading agents...
              </div>
            ) : agents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active agents available
              </p>
            ) : (
              <Select
                value={selectedAgentId}
                onValueChange={setSelectedAgentId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center gap-2">
                        <span>{agent.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({agent.permission_tier})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Prompt */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Prompt</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What should the agent do?"
              rows={5}
            />
          </div>

          {/* Entity reference (optional) */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Entity reference{' '}
              <span className="text-xs text-muted-foreground">(optional)</span>
            </label>
            <Input
              value={entityRef}
              onChange={(e) => setEntityRef(e.target.value)}
              placeholder="e.g. task:abc123 or project:xyz"
            />
            <p className="text-xs text-muted-foreground">
              Reference a specific entity the agent should work on.
            </p>
          </div>

          {/* Dispatch button */}
          <Button
            className="w-full"
            onClick={handleDispatch}
            disabled={dispatching || !selectedAgentId || !prompt.trim()}
          >
            {dispatching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Dispatching...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Dispatch
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
