export interface ParsedArgs {
  command: string;
  subcommand: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2); // skip node and script path
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      // Check if next arg is a value (not a flag)
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      // Short flags like -j
      const key = arg.slice(1);
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return {
    command: positional[0] || '',
    subcommand: positional[1] || '',
    positional: positional.slice(2),
    flags,
  };
}

export function getFlag(flags: Record<string, string | boolean>, name: string, defaultValue = ''): string {
  const val = flags[name];
  if (val === undefined || val === true) return defaultValue;
  return String(val);
}

export function getFlagNumber(flags: Record<string, string | boolean>, name: string, defaultValue: number): number {
  const val = getFlag(flags, name);
  if (!val) return defaultValue;
  const num = parseInt(val, 10);
  return isNaN(num) ? defaultValue : num;
}

export function hasFlag(flags: Record<string, string | boolean>, name: string): boolean {
  return flags[name] !== undefined;
}

export function requirePositional(positional: string[], index: number, name: string): string {
  const val = positional[index];
  if (!val) {
    console.error(`Error: Missing required argument: ${name}`);
    process.exit(1);
  }
  return val;
}
