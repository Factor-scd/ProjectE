import { parseArgs, getFlag, getFlagNumber, requirePositional } from '../lib/args.js';
import { printTable, printJson, printSuccess, printError } from '../lib/output.js';
import { db, records, eq, sql } from '../lib/db.js';
import { createHash, randomBytes } from 'node:crypto';

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    createHash('sha256').update(salt + password).digest('hex', (err, hash) => {
      if (err) reject(err);
      resolve(`${salt}:${hash}`);
    });
  });
}

async function listUsers(flags: Record<string, string | boolean>): Promise<void> {
  const limit = getFlagNumber(flags, 'limit', 50);
  const json = flags.json === true;

  const rows = await db.select().from(records)
    .where(eq(records.collection, 'users'))
    .limit(limit);

  const users = rows.map((r) => ({
    id: r.id,
    ...r.data as Record<string, unknown>,
    created: r.createdAt.toISOString(),
  }));

  if (json) {
    printJson(users);
  } else {
    printTable(users, [
      { key: 'id', label: 'ID', width: 36 },
      { key: 'email', label: 'Email' },
      { key: 'name', label: 'Name' },
      { key: 'created', label: 'Created', width: 20 },
    ]);
    console.log(`\n${users.length} user(s)`);
  }
}

async function createUser(flags: Record<string, string | boolean>): Promise<void> {
  const email = getFlag(flags, 'email');
  const name = getFlag(flags, 'name');
  const password = getFlag(flags, 'password');

  if (!email || !name || !password) {
    printError('Required flags: --email, --name, --password');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const [record] = await db.insert(records).values({
    collection: 'users',
    data: { email, name, passwordHash },
  }).returning();

  printSuccess(`User created: ${record.id} (${email})`);
}

async function deleteUser(flags: Record<string, string | boolean>): Promise<void> {
  const id = requirePositional(Object.entries(flags).length ? [] : [], 0, 'user ID');

  // Try to get from positional args passed from main
  const args = process.argv.slice(4); // after "user delete"
  const userId = args[0] || id;

  if (!userId) {
    printError('Usage: user delete <id>');
    process.exit(1);
  }

  const deleted = await db.delete(records)
    .where(eq(records.id, userId))
    .returning();

  if (deleted.length === 0) {
    printError(`User ${userId} not found`);
    process.exit(1);
  }

  printSuccess(`User deleted: ${userId}`);
}

async function resetPassword(flags: Record<string, string | boolean>): Promise<void> {
  const args = process.argv.slice(4);
  const userId = args[0];
  const newPassword = getFlag(flags, 'password');

  if (!userId || !newPassword) {
    printError('Usage: user reset-password <id> --password <new-password>');
    process.exit(1);
  }

  const passwordHash = await hashPassword(newPassword);

  const updated = await db.update(records)
    .set({ data: { passwordHash } })
    .where(eq(records.id, userId))
    .returning();

  if (updated.length === 0) {
    printError(`User ${userId} not found`);
    process.exit(1);
  }

  printSuccess(`Password reset for user: ${userId}`);
}

function showHelp(): void {
  console.log(`
User Management Commands:

  user list [--limit N] [--json]
      List all users

  user create --email <email> --name <name> --password <password>
      Create a new user

  user delete <id>
      Delete a user by ID

  user reset-password <id> --password <new-password>
      Reset a user's password
`);
}

export default async function main(): Promise<void> {
  const { subcommand, flags } = parseArgs(process.argv);

  switch (subcommand) {
    case 'list':
      await listUsers(flags);
      break;
    case 'create':
      await createUser(flags);
      break;
    case 'delete':
      await deleteUser(flags);
      break;
    case 'reset-password':
      await resetPassword(flags);
      break;
    default:
      showHelp();
  }
}
