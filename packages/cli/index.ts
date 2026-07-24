#!/usr/bin/env node

import { parseArgs } from './lib/args.js';
import { printError, printHeader, printJson } from './lib/output.js';

const commands: Record<string, () => Promise<void>> = {
  user: () => import('./commands/user.js').then((m) => m.default()),
  data: () => import('./commands/data.js').then((m) => m.default()),
  worker: () => import('./commands/worker.js').then((m) => m.default()),
  health: () => import('./commands/health.js').then((m) => m.default()),
  webhook: () => import('./commands/webhook.js').then((m) => m.default()),
  agent: () => import('./commands/agent.js').then((m) => m.default()),
};

function showHelp(): void {
  printHeader('Project E Admin CLI');
  console.log(`
Usage: npx tsx packages/cli/index.ts <command> [subcommand] [options]

Commands:
  user       User management (list, create, delete, reset-password)
  data       Data CRUD and import/export for all collections
  worker     Queue and worker management
  health     System health and diagnostics
  webhook    Webhook management and testing
  agent      Agent management and task triggers

Global Options:
  --json     Output results as JSON
  --help     Show help for a command

Examples:
  npx tsx packages/cli/index.ts health check
  npx tsx packages/cli/index.ts user list --json
  npx tsx packages/cli/index.ts data list projects --limit 10
  npx tsx packages/cli/index.ts worker status
`);
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv);

  if (!command || command === 'help' || hasFlag(flags, 'help')) {
    showHelp();
    return;
  }

  const handler = commands[command];
  if (!handler) {
    printError(`Unknown command: ${command}`);
    console.log('Run with --help to see available commands.');
    process.exit(1);
  }

  try {
    await handler();
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function hasFlag(flags: Record<string, string | boolean>, name: string): boolean {
  return flags[name] !== undefined;
}

main();
