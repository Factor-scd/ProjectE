import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTaskTools } from './tools/tasks';
import { registerHabitTools } from './tools/habits';
import { registerProjectTools } from './tools/projects';
import { registerNoteTools } from './tools/notes';
import { registerReportTools } from './tools/reports';
import { registerMilestoneTools } from './tools/milestones';
import { registerDomainTools } from './tools/domains';
import { registerTagTools } from './tools/tags';
import { registerAgentTools } from './tools/agents';
import { registerWebhookTools } from './tools/webhooks';
import { registerAnalyticsTools } from './tools/analytics';

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'project-e',
    version: '1.0.0',
  }, {
    capabilities: {
      tools: {},
    },
  });

  // Register all tools
  registerTaskTools(server);
  registerHabitTools(server);
  registerProjectTools(server);
  registerNoteTools(server);
  registerReportTools(server);
  registerMilestoneTools(server);
  registerDomainTools(server);
  registerTagTools(server);
  registerAgentTools(server);
  registerWebhookTools(server);
  registerAnalyticsTools(server);

  return server;
}
