'use client';

import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, XCircle, Clock, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Agent {
  id: string;
  name: string;
  avatar?: string;
  description?: string;
  permission_tier: string;
  status: 'active' | 'disabled';
  last_activity_at?: string;
}

interface AgentActivity {
  id: string;
  agent_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  created: string;
}

interface AgentTask {
  id: string;
  agent_id: string;
  task_type: string;
  input: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  output?: Record<string, unknown>;
  created: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activity, setActivity] = useState<AgentActivity[]>([]);
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  useEffect(() => {
    fetchAgents();
    fetchActivity();
    fetchAgentTasks();
  }, []);

  async function fetchAgents() {
    try {
      const response = await fetch('/api/agents');
      if (response.ok) {
        const data = await response.json();
        setAgents(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchActivity() {
    try {
      const response = await fetch('/api/agent-activity?sort=-created&perPage=50');
      if (response.ok) {
        const data = await response.json();
        setActivity(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch activity:', error);
    }
  }

  async function fetchAgentTasks() {
    try {
      const response = await fetch('/api/agent-tasks?sort=-created&perPage=50');
      if (response.ok) {
        const data = await response.json();
        setAgentTasks(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch agent tasks:', error);
    }
  }

  async function undoActivity(activityId: string) {
    try {
      await fetch(`/api/agent-activity/${activityId}/undo`, {
        method: 'POST',
      });
      fetchActivity();
    } catch (error) {
      console.error('Failed to undo activity:', error);
    }
  }

  function getAgentName(agentId: string): string {
    const agent = agents.find((a) => a.id === agentId);
    return agent?.name || 'Unknown Agent';
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-600 animate-pulse" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  }

  function getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      create: 'Created',
      update: 'Updated',
      delete: 'Deleted',
      complete: 'Completed',
      assign: 'Assigned',
    };
    return labels[action] || action;
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading agent activity...</p>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Agent Activity</h1>
        <p className="mt-1 text-muted-foreground">
          Every agent action, visible and reversible.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        {/* Agents list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agents</CardTitle>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No agents configured
              </p>
            ) : (
              <div className="space-y-2">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent)}
                    aria-label={`View activity for agent: ${agent.name}`}
                    aria-current={selectedAgent?.id === agent.id ? 'true' : undefined}
                    className={`w-full rounded-lg p-3 text-left transition-colors ${
                      selectedAgent?.id === agent.id
                        ? 'bg-accent'
                        : 'hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {agent.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{agent.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={agent.status === 'active' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {agent.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {agent.permission_tier}
                          </span>
                        </div>
                      </div>
                      {agent.last_activity_at && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(agent.last_activity_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" aria-hidden="true" />
              Activity Feed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="activity">
              <TabsList>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
              </TabsList>

              <TabsContent value="activity" className="mt-4">
                {activity.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">
                    No agent activity yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {activity.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border p-4 transition-colors hover:bg-accent/50"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>
                                {getAgentName(item.agent_id).charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {getAgentName(item.agent_id)}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {getActionLabel(item.action)}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {item.entity_type}
                                </Badge>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {new Date(item.created).toLocaleString()}
                              </p>
                              {item.before_state && item.after_state && (
                                <details className="mt-2">
                                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground" role="button">
                                    View changes
                                  </summary>
                                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <p className="font-semibold text-red-600">Before</p>
                                      <pre className="mt-1 rounded bg-muted p-2 overflow-x-auto">
                                        {JSON.stringify(item.before_state, null, 2)}
                                      </pre>
                                    </div>
                                    <div>
                                      <p className="font-semibold text-green-600">After</p>
                                      <pre className="mt-1 rounded bg-muted p-2 overflow-x-auto">
                                        {JSON.stringify(item.after_state, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                </details>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => undoActivity(item.id)}
                            className="shrink-0"
                            aria-label={`Undo activity: ${getActionLabel(item.action)} ${item.entity_type}`}
                          >
                            <RotateCcw className="mr-1 h-3 w-3" aria-hidden="true" />
                            Undo
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="tasks" className="mt-4">
                {agentTasks.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">
                    No agent tasks yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {agentTasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-lg border p-4"
                      >
                        <div className="flex items-start gap-3">
                          {getStatusIcon(task.status)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {getAgentName(task.agent_id)}
                              </span>
                              <Badge
                                variant={
                                  task.status === 'completed'
                                    ? 'default'
                                    : task.status === 'failed'
                                    ? 'destructive'
                                    : 'secondary'
                                }
                                className="text-xs"
                              >
                                {task.status}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm">{task.input}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(task.created).toLocaleString()}
                            </p>
                            {task.output && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground" role="button">
                                  View output
                                </summary>
                                <pre className="mt-2 rounded bg-muted p-2 text-xs overflow-x-auto">
                                  {JSON.stringify(task.output, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
