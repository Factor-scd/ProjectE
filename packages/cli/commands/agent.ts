import { parseArgs, getFlag, getFlagNumber, hasFlag } from '../lib/args.js';
import { printTable, printJson, printSuccess, printError, printHeader } from '../lib/output.js';
import { db, records, eq, sql } from '../lib/db.js';

async function listAgents(flags: Record<string, string | boolean>): Promise<void> {
  const limit = getFlagNumber(flags, 'limit', 50);
  const json = flags.json === true;

  const rows = await db.select().from(records)
    .where(eq(records.collection, 'agents'))
    .limit(limit);

  const agents = rows.map((r) => {
    const data = r.data as Record<string, unknown>;
    return {
      id: r.id,
      name: data.name || '',
      webhook_url: String(data.webhook_url || '').slice(0, 40),
      active: data.active,
      last_activity: data.last_activity_at ? String(data.last_activity_at).slice(0, 19) : 'never',
      created: r.createdAt.toISOString().slice(0, 19),
    };
  });

  if (json) {
    printJson(agents);
  } else {
    printTable(agents, [
      { key: 'id', label: 'ID', width: 36 },
      { key: 'name', label: 'Name', width: 20 },
      { key: 'webhook_url', label: 'Webhook URL', width: 40 },
      { key: 'active', label: 'Active', width: 8 },
      { key: 'last_activity', label: 'Last Activity', width: 20 },
    ]);
    console.log(`\n${agents.length} agent(s)`);
  }
}

async function getAgent(flags: Record<string, string | boolean>): Promise<void> {
  const args = process.argv.slice(4);
  const agentId = args[0];

  if (!agentId) {
    printError('Usage: agent get <id>');
    process.exit(1);
  }

  const [row] = await db.select().from(records)
    .where(eq(records.id, agentId))
    .limit(1);

  if (!row) {
    printError(`Agent ${agentId} not found`);
    process.exit(1);
  }

  const item = {
    id: row.id,
    ...row.data as Record<string, unknown>,
    created: row.createdAt.toISOString(),
    updated: row.updatedAt.toISOString(),
  };

  if (flags.json === true) {
    printJson(item);
  } else {
    printHeader('Agent Details');
    for (const [key, value] of Object.entries(item)) {
      console.log(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
    }
  }
}

async function createAgent(flags: Record<string, string | boolean>): Promise<void> {
  const name = getFlag(flags, 'name');
  const webhookUrl = getFlag(flags, 'webhook-url');
  const apiKey = getFlag(flags, 'api-key');

  if (!name) {
    printError('Required: --name <name>');
    process.exit(1);
  }

  const [record] = await db.insert(records).values({
    collection: 'agents',
    data: {
      name,
      webhook_url: webhookUrl,
      api_key: apiKey,
      active: true,
      last_activity_at: null,
    },
  }).returning();

  printSuccess(`Agent created: ${record.id} (${name})`);
}

async function listAgentTasks(flags: Record<string, string | boolean>): Promise<void> {
  const limit = getFlagNumber(flags, 'limit', 50);
  const agentId = getFlag(flags, 'agent-id');
  const status = getFlag(flags, 'status');
  const json = flags.json === true;

  let rows = await db.select().from(records)
    .where(eq(records.collection, 'agent_tasks'));

  if (agentId) {
    rows = rows.filter((r) => (r.data as Record<string, unknown>).agent_id === agentId);
  }
  if (status) {
    rows = rows.filter((r) => (r.data as Record<string, unknown>).status === status);
  }

  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  rows = rows.slice(0, limit);

  const tasks = rows.map((r) => {
    const data = r.data as Record<string, unknown>;
    return {
      id: r.id,
      agent_id: String(data.agent_id || '').slice(0, 36),
      entity_type: data.entity_type,
      status: data.status,
      instruction: String(data.instruction || '').slice(0, 50),
      created: r.createdAt.toISOString().slice(0, 19),
    };
  });

  if (json) {
    printJson(tasks);
  } else {
    printTable(tasks, [
      { key: 'id', label: 'ID', width: 36 },
      { key: 'agent_id', label: 'Agent', width: 36 },
      { key: 'entity_type', label: 'Entity', width: 12 },
      { key: 'status', label: 'Status', width: 12 },
      { key: 'instruction', label: 'Instruction', width: 40 },
      { key: 'created', label: 'Created', width: 20 },
    ]);
    console.log(`\n${tasks.length} task(s)`);
  }
}

async function triggerAgent(flags: Record<string, string | boolean>): Promise<void> {
  const args = process.argv.slice(4);
  const agentId = args[0];
  const instruction = getFlag(flags, 'instruction');
  const entityType = getFlag(flags, 'entity-type', 'note');
  const entityId = getFlag(flags, 'entity-id', '');

  if (!agentId || !instruction) {
    printError('Usage: agent trigger <agentId> --instruction <text> [--entity-type <type>] [--entity-id <id>]');
    process.exit(1);
  }

  // Get agent details
  const [agentRow] = await db.select().from(records)
    .where(eq(records.id, agentId))
    .limit(1);

  if (!agentRow) {
    printError(`Agent ${agentId} not found`);
    process.exit(1);
  }

  const agentData = agentRow.data as Record<string, unknown>;

  // Create agent task
  const [task] = await db.insert(records).values({
    collection: 'agent_tasks',
    data: {
      agent_id: agentId,
      entity_type: entityType,
      entity_id: entityId,
      instruction,
      status: 'pending',
    },
  }).returning();

  // Queue the job
  const [job] = await db.insert(records).values({
    collection: 'queue_jobs',
    data: {
      type: 'agent_mention',
      queue: 'agents',
      payload: {
        agent_task_id: task.id,
        agent_id: agentId,
        agent_webhook_url: agentData.webhook_url,
        agent_api_key: agentData.api_key,
        entity_type: entityType,
        entity_id: entityId,
        instruction,
      },
      status: 'pending',
      retry_count: 0,
      max_retries: 3,
      scheduled_at: new Date().toISOString(),
    },
  }).returning();

  printSuccess(`Agent task created: ${task.id} (job: ${job.id})`);
  printSuccess(`Agent "${agentData.name}" will process: ${instruction.slice(0, 60)}`);
}

async function listActivity(flags: Record<string, string | boolean>): Promise<void> {
  const limit = getFlagNumber(flags, 'limit', 50);
  const agentId = getFlag(flags, 'agent-id');
  const json = flags.json === true;

  let rows = await db.select().from(records)
    .where(eq(records.collection, 'agent_activity'));

  if (agentId) {
    rows = rows.filter((r) => (r.data as Record<string, unknown>).agent_id === agentId);
  }

  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  rows = rows.slice(0, limit);

  const activities = rows.map((r) => {
    const data = r.data as Record<string, unknown>;
    return {
      id: r.id,
      agent_id: String(data.agent_id || '').slice(0, 36),
      action: data.action,
      entity_type: data.entity_type,
      entity_id: String(data.entity_id || '').slice(0, 36),
      description: String(data.description || '').slice(0, 50),
      created: r.createdAt.toISOString().slice(0, 19),
    };
  });

  if (json) {
    printJson(activities);
  } else {
    printTable(activities, [
      { key: 'id', label: 'ID', width: 36 },
      { key: 'agent_id', label: 'Agent', width: 36 },
      { key: 'action', label: 'Action', width: 15 },
      { key: 'entity_type', label: 'Entity', width: 12 },
      { key: 'description', label: 'Description', width: 40 },
      { key: 'created', label: 'Created', width: 20 },
    ]);
    console.log(`\n${activities.length} activity record(s)`);
  }
}

function showHelp(): void {
  console.log(`
Agent Management Commands:

  agent list [--limit N] [--json]
      List all agents

  agent get <id> [--json]
      Get agent details

  agent create --name <name> [--webhook-url <url>] [--api-key <key>]
      Create a new agent

  agent tasks [--agent-id <id>] [--status pending|in_progress|completed] [--limit N] [--json]
      List agent tasks

  agent trigger <agentId> --instruction <text> [--entity-type <type>] [--entity-id <id>]
      Trigger an agent task

  agent activity [--agent-id <id>] [--limit N] [--json]
      List agent activity records
`);
}

export default async function main(): Promise<void> {
  const { subcommand, flags } = parseArgs(process.argv);

  switch (subcommand) {
    case 'list':
      await listAgents(flags);
      break;
    case 'get':
      await getAgent(flags);
      break;
    case 'create':
      await createAgent(flags);
      break;
    case 'tasks':
      await listAgentTasks(flags);
      break;
    case 'trigger':
      await triggerAgent(flags);
      break;
    case 'activity':
      await listActivity(flags);
      break;
    default:
      showHelp();
  }
}
