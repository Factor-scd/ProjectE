import { createAdminClient } from '../pocketbase';
import type { Agent, AgentTask } from '@project-e/shared';

/** Cast a PocketBase RecordModel to a typed domain model */
function asAgent(record: Record<string, unknown>): Agent {
  return record as unknown as Agent;
}

/** Cast a PocketBase RecordModel to a typed domain model */
function asAgentTask(record: Record<string, unknown>): AgentTask {
  return record as unknown as AgentTask;
}

/**
 * Parse @mentions from text content
 * Matches @agentname pattern
 */
export function parseMentions(content: string): string[] {
  const regex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    mentions.push(match[1].toLowerCase());
  }

  return [...new Set(mentions)]; // Deduplicate
}

/**
 * Process @mentions in content and route to agents
 */
export async function processMentions(
  content: string,
  entityType: string,
  entityId: string,
  userId: string
): Promise<AgentTask[]> {
  const mentionNames = parseMentions(content);
  if (mentionNames.length === 0) return [];

  const pb = createAdminClient();
  const createdTasks: AgentTask[] = [];

  for (const mentionName of mentionNames) {
    // Find agent by name (case-insensitive)
    const agentResults = await pb.collection('agents').getFullList({
      filter: 'status = "active"',
    });
    const agents = agentResults.map((r) => asAgent(r as unknown as Record<string, unknown>));

    const agent = agents.find((a) => a.name.toLowerCase() === mentionName);
    if (!agent) continue;

    // Extract instruction text after the @mention
    const mentionRegex = new RegExp(`@${mentionName}\\s+(.+?)(?=@\\w+|$)`, 'is');
    const mentionMatch = content.match(mentionRegex);
    const instruction = mentionMatch ? mentionMatch[1].trim() : '';

    // Create agent task
    const agentTaskRecord = await pb.collection('agent_tasks').create({
      agent_id: agent.id,
      task_type: 'mention',
      input: {
        entity_type: entityType,
        entity_id: entityId,
        instruction,
        user_id: userId,
      },
      status: 'pending',
    });
    const agentTask = asAgentTask(agentTaskRecord as unknown as Record<string, unknown>);

    createdTasks.push(agentTask);

    // Queue webhook delivery to agent if it has a webhook URL in config
    const agentConfig = (agent.config || {}) as Record<string, unknown>;
    const webhookUrl = agentConfig.webhook_url as string | undefined;

    if (webhookUrl && agent.api_key) {
      await pb.collection('queue_jobs').create({
        queue: 'agents',
        type: 'agent_mention',
        payload: {
          agent_task_id: agentTask.id,
          agent_id: agent.id,
          agent_webhook_url: webhookUrl,
          agent_api_key: agent.api_key,
          entity_type: entityType,
          entity_id: entityId,
          instruction,
          user_id: userId,
        },
        status: 'pending',
        attempts: 0,
        max_attempts: 3,
        scheduled_at: new Date().toISOString(),
      });
    }
  }

  return createdTasks;
}

/**
 * Deliver @mention to agent via webhook
 */
export async function deliverAgentMention(payload: {
  agent_task_id: string;
  agent_id: string;
  agent_webhook_url: string;
  agent_api_key: string;
  entity_type: string;
  entity_id: string;
  instruction: string;
  user_id: string;
}): Promise<{ success: boolean; statusCode?: number; responseBody?: string }> {
  const { agent_webhook_url, agent_api_key, ...body } = payload;

  try {
    const response = await fetch(agent_webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${agent_api_key}`,
        'X-Agent-Task-Id': payload.agent_task_id,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000), // 30 second timeout for agent work
    });

    const responseBody = await response.text();

    return {
      success: response.ok,
      statusCode: response.status,
      responseBody,
    };
  } catch (error) {
    return {
      success: false,
      responseBody: String(error),
    };
  }
}
