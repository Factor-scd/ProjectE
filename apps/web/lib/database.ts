/**
 * v1 EAV Database Layer — REMOVED in v2
 *
 * The old `records` table has been removed (spec section 12.3).
 * All v1 API routes that used this module will be replaced in Phase 2+.
 *
 * This stub exists so the build compiles. It returns empty results at runtime.
 * New code should use Drizzle directly via `@project-e/db`.
 */
import { db, sql } from '@project-e/db';

export const collectionNames = [
  'domains', 'tags', 'projects', 'project_settings', 'milestones',
  'milestone_dependencies', 'milestone_templates', 'milestone_history', 'tasks',
  'task_subtasks', 'task_dependencies', 'task_attachments', 'task_time_entries',
  'time_entries', 'habits', 'habit_logs', 'habit_skip_days', 'notes', 'note_links',
  'note_task_links', 'report_templates', 'reports', 'canvases', 'canvas_cards',
  'agents', 'agent_activity', 'webhooks', 'webhook_deliveries', 'agent_tasks',
  'notifications', 'error_logs', 'queue_jobs',
] as const;

type RecordData = Record<string, any>;
type ListOptions = { filter?: string; sort?: string };

class CollectionRepository {
  constructor(private readonly collectionName: string) {}

  async getOne(id: string): Promise<RecordData> {
    return { id, collectionName: this.collectionName };
  }

  async getFullList(options: ListOptions = {}): Promise<RecordData[]> {
    return [];
  }

  async getList(page = 1, perPage = 50, options: ListOptions = {}) {
    return {
      items: [] as RecordData[],
      page,
      perPage,
      totalItems: 0,
      totalPages: 0,
    };
  }

  async create(data: RecordData): Promise<RecordData> {
    return { ...data, id: 'stub', collectionName: this.collectionName };
  }

  async update(id: string, data: RecordData): Promise<RecordData> {
    return { ...data, id, collectionName: this.collectionName };
  }

  async delete(id: string): Promise<boolean> {
    return true;
  }
}

export function createDatabaseClient() {
  return {
    collection(name: string) {
      if (!collectionNames.includes(name as (typeof collectionNames)[number])) {
        throw new Error(`Unknown collection: ${name}`);
      }
      return new CollectionRepository(name);
    },
  };
}

export function createAdminClient() {
  return createDatabaseClient();
}
