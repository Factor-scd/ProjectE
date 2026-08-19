import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ── Custom tsvector type for full-text search ─────────────────────────────────
export const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

// ── Enums ──────────────────────────────────────────────────────────────────────

export const statusCategoryEnum = pgEnum('status_category', ['todo', 'in_progress', 'done', 'cancelled']);
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent']);
export const habitFrequencyEnum = pgEnum('habit_frequency', ['daily', 'weekly', 'custom']);
export const habitDifficultyEnum = pgEnum('habit_difficulty', ['easy', 'medium', 'hard']);
export const projectStatusEnum = pgEnum('project_status', ['active', 'paused', 'completed', 'archived']);
export const sectionKindEnum = pgEnum('section_kind', ['section', 'milestone']);
export const sectionStatusEnum = pgEnum('section_status', ['planned', 'in_progress', 'complete']);
export const tagScopeEnum = pgEnum('tag_scope', ['global', 'tasks', 'habits', 'projects', 'notes']);
export const jobStatusEnum = pgEnum('job_status', ['pending', 'processing', 'completed', 'failed']);

// ── Users ──────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  passkeyCredentialId: text('passkey_credential_id'),
  passkeyPublicKey: text('passkey_public_key'),
  passkeyCounter: integer('passkey_counter').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── Domains (Workspaces) ───────────────────────────────────────────────────────

export const domains = pgTable(
  'domains',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    color: text('color'),
    icon: text('icon'),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): any => domains.id, { onDelete: 'set null' }),
    sortOrder: integer('sort_order').default(0),
    customFields: jsonb('custom_fields').$type<Record<string, unknown>>().default({}),
    searchVector: tsvector('search_vector'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('domains_parent_id_idx').on(table.parentId),
    index('domains_slug_idx').on(table.slug),
    index('domains_search_idx').using('gin', table.searchVector),
  ]
);

// ── Tags ────────────────────────────────────────────────────────────────────────

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    color: text('color'),
    scope: tagScopeEnum('scope').notNull().default('global'),
    parentId: uuid('parent_id').references((): any => tags.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('tags_parent_id_idx').on(table.parentId),
    index('tags_scope_idx').on(table.scope),
  ]
);

// ── Projects ────────────────────────────────────────────────────────────────────

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    status: projectStatusEnum('status').notNull().default('active'),
    domainId: uuid('domain_id')
      .notNull()
      .references((): any => domains.id, { onDelete: 'cascade' }),
    color: text('color'),
    icon: text('icon'),
    targetDate: timestamp('target_date', { withTimezone: true }),
    searchVector: tsvector('search_vector'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('projects_domain_id_idx').on(table.domainId),
    index('projects_status_idx').on(table.status),
    index('projects_deleted_at_idx').on(table.deletedAt),
    index('projects_search_idx').using('gin', table.searchVector),
  ]
);

// ── Status Definitions ─────────────────────────────────────────────────────────
// Per-project configurable task workflow statuses. `category` maps a user-defined
// status to the UI semantics that drive progress (done), board columns, and
// completion checks. `key` is a stable machine id per project; `label` is the
// display name.

export const statusDefinitions = pgTable(
  'status_definitions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references((): any => projects.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    category: statusCategoryEnum('category').notNull().default('todo'),
    color: text('color'),
    sortOrder: integer('sort_order').default(0),
    isDefault: boolean('is_default').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('status_definitions_project_key_idx').on(table.projectId, table.key),
    index('status_definitions_project_id_idx').on(table.projectId),
  ]
);

// ── Automation Rules ─────────────────────────────────────────────────────────────
// No-code trigger-action rules scoped to a single project. `trigger` names the
// event, `conditions` filter when it fires, and `actions` run in order when a
// rule matches. Config-only rows — deleted rules are hard-deleted.

export const automationRules = pgTable(
  'automation_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references((): any => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    active: boolean('active').default(true),
    trigger: jsonb('trigger')
      .notNull()
      .$type<{ type: string; params?: Record<string, any> }>(),
    conditions: jsonb('conditions')
      .$type<{ field: string; op: string; value: any }[]>()
      .default([]),
    actions: jsonb('actions')
      .notNull()
      .$type<{ type: string; params: Record<string, any> }[]>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('automation_rules_project_id_idx').on(table.projectId),
  ]
);

// ── Sections ────────────────────────────────────────────────────────────────────

export const sections = pgTable(
  'sections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    projectId: uuid('project_id')
      .notNull()
      .references((): any => projects.id, { onDelete: 'cascade' }),
    kind: sectionKindEnum('kind').notNull().default('section'),
    status: sectionStatusEnum('status').notNull().default('planned'),
    targetDate: timestamp('target_date', { withTimezone: true }),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sections_project_id_idx').on(table.projectId),
    index('sections_kind_idx').on(table.kind),
    index('sections_sort_order_idx').on(table.projectId, table.sortOrder),
  ]
);

// ── Tasks ───────────────────────────────────────────────────────────────────────

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    statusId: uuid('status_id').references((): any => statusDefinitions.id, { onDelete: 'set null' }),
    priority: taskPriorityEnum('priority').notNull().default('medium'),
    domainId: uuid('domain_id')
      .notNull()
      .references((): any => domains.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references((): any => projects.id, { onDelete: 'set null' }),
    sectionId: uuid('section_id').references((): any => sections.id, { onDelete: 'set null' }),
    parentId: uuid('parent_id').references((): any => tasks.id, { onDelete: 'set null' }),
    dueDate: timestamp('due_date', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    estimatedMinutes: integer('estimated_minutes'),
    trackedMinutes: integer('tracked_minutes').default(0),
    recurrenceRule: text('recurrence_rule'),
    order: integer('order').default(0),
    customFields: jsonb('custom_fields').$type<Record<string, unknown>>().default({}),
    searchVector: tsvector('search_vector'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('tasks_domain_id_idx').on(table.domainId),
    index('tasks_project_id_idx').on(table.projectId),
    index('tasks_section_id_idx').on(table.sectionId),
    index('tasks_parent_id_idx').on(table.parentId),
    index('tasks_status_id_idx').on(table.statusId),
    index('tasks_priority_idx').on(table.priority),
    index('tasks_due_date_idx').on(table.dueDate),
    index('tasks_order_idx').on(table.order),
    index('tasks_deleted_at_idx').on(table.deletedAt),
    index('tasks_search_idx').using('gin', table.searchVector),
  ]
);

// ── Task Tags (junction) ────────────────────────────────────────────────────────

export const taskTags = pgTable(
  'task_tags',
  {
    taskId: uuid('task_id')
      .notNull()
      .references((): any => tasks.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references((): any => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.tagId] }),
    index('task_tags_tag_id_idx').on(table.tagId),
  ]
);

// ── Task Dependencies (junction) ───────────────────────────────────────────────

export const taskDependencies = pgTable(
  'task_dependencies',
  {
    taskId: uuid('task_id')
      .notNull()
      .references((): any => tasks.id, { onDelete: 'cascade' }),
    dependsOnTaskId: uuid('depends_on_task_id')
      .notNull()
      .references((): any => tasks.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.dependsOnTaskId] }),
    index('task_dependencies_depends_on_idx').on(table.dependsOnTaskId),
  ]
);

// ── Habits ──────────────────────────────────────────────────────────────────────

export const habits = pgTable(
  'habits',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    domainId: uuid('domain_id')
      .notNull()
      .references((): any => domains.id, { onDelete: 'cascade' }),
    frequency: habitFrequencyEnum('frequency').notNull().default('daily'),
    difficulty: habitDifficultyEnum('difficulty').notNull().default('medium'),
    goalPerPeriod: integer('goal_per_period').default(1),
    unit: text('unit'),
    reminderTime: time('reminder_time'),
    skipDays: integer('skip_days').array().default([]),
    streakCount: integer('streak_count').default(0),
    bestStreak: integer('best_streak').default(0),
    moodTracking: boolean('mood_tracking').default(false),
    active: boolean('active').default(true),
    searchVector: tsvector('search_vector'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('habits_domain_id_idx').on(table.domainId),
    index('habits_active_idx').on(table.active),
    index('habits_deleted_at_idx').on(table.deletedAt),
    index('habits_search_idx').using('gin', table.searchVector),
  ]
);

// ── Habit Completions ───────────────────────────────────────────────────────────

export const habitCompletions = pgTable(
  'habit_completions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    habitId: uuid('habit_id')
      .notNull()
      .references((): any => habits.id, { onDelete: 'cascade' }),
    date: timestamp('date', { withTimezone: true }).notNull(),
    value: integer('value').default(1),
    mood: integer('mood'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('habit_completions_habit_id_idx').on(table.habitId),
    index('habit_completions_date_idx').on(table.habitId, table.date),
  ]
);

// ── Habit Tags (junction) ───────────────────────────────────────────────────────

export const habitTags = pgTable(
  'habit_tags',
  {
    habitId: uuid('habit_id')
      .notNull()
      .references((): any => habits.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references((): any => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.habitId, table.tagId] }),
    index('habit_tags_tag_id_idx').on(table.tagId),
  ]
);

// ── Notes ───────────────────────────────────────────────────────────────────────

export const notes = pgTable(
  'notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    content: text('content'),
    domainId: uuid('domain_id')
      .notNull()
      .references((): any => domains.id, { onDelete: 'cascade' }),
    isPinned: boolean('is_pinned').default(false),
    isArchived: boolean('is_archived').default(false),
    searchVector: tsvector('search_vector'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('notes_domain_id_idx').on(table.domainId),
    index('notes_is_pinned_idx').on(table.isPinned),
    index('notes_is_archived_idx').on(table.isArchived),
    index('notes_deleted_at_idx').on(table.deletedAt),
    index('notes_search_idx').using('gin', table.searchVector),
  ]
);

// ── Note Links (wikilinks / backlinks) ─────────────────────────────────────────

export const noteLinks = pgTable(
  'note_links',
  {
    sourceNoteId: uuid('source_note_id')
      .notNull()
      .references((): any => notes.id, { onDelete: 'cascade' }),
    targetNoteId: uuid('target_note_id')
      .notNull()
      .references((): any => notes.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.sourceNoteId, table.targetNoteId] }),
    index('note_links_target_note_id_idx').on(table.targetNoteId),
  ]
);

// ── Note Entity Links (cross-entity linking) ────────────────────────────────────

export const noteEntityLinks = pgTable(
  'note_entity_links',
  {
    noteId: uuid('note_id')
      .notNull()
      .references((): any => notes.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
  },
  (table) => [
    index('note_entity_links_entity_idx').on(table.entityType, table.entityId),
    index('note_entity_links_note_id_idx').on(table.noteId),
  ]
);

// ── Note Tags (junction) ────────────────────────────────────────────────────────

export const noteTags = pgTable(
  'note_tags',
  {
    noteId: uuid('note_id')
      .notNull()
      .references((): any => notes.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references((): any => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.noteId, table.tagId] }),
    index('note_tags_tag_id_idx').on(table.tagId),
  ]
);

// ── Project Tags (junction) ─────────────────────────────────────────────────────

export const projectTags = pgTable(
  'project_tags',
  {
    projectId: uuid('project_id')
      .notNull()
      .references((): any => projects.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references((): any => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.tagId] }),
    index('project_tags_tag_id_idx').on(table.tagId),
  ]
);

// ── Activity Feed ───────────────────────────────────────────────────────────────

export const activityFeed = pgTable(
  'activity_feed',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    changes: jsonb('changes').$type<Record<string, unknown>>(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references((): any => domains.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('activity_feed_workspace_id_idx').on(table.workspaceId),
    index('activity_feed_entity_idx').on(table.entityType, table.entityId),
    index('activity_feed_created_at_idx').on(table.createdAt),
    index('activity_feed_actor_idx').on(table.actor),
  ]
);

// ── Notifications ─────────────────────────────────────────────────────────────
// Per-user in-app notifications. `readAt` NULL means unread; rows are soft-
// deleted (deleted_at set) rather than removed so the unread/read history can
// be reconstructed if a notification is ever un-deleted.

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references((): any => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references((): any => domains.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'mention', 'status_change', 'due_soon', 'automation', 'assignment'
    title: text('title').notNull(),
    body: text('body'),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    readAt: timestamp('read_at', { withTimezone: true }), // NULL = unread
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('notifications_user_id_idx').on(table.userId),
    index('notifications_user_read_idx').on(table.userId, table.readAt),
    index('notifications_workspace_id_idx').on(table.workspaceId),
    index('notifications_entity_idx').on(table.entityType, table.entityId),
  ]
);

// ── Comments ───────────────────────────────────────────────────────────────────
// Nested comment threads on any entity. Comments were previously stored as
// activity_feed rows (entity_type='comment'); they now live here so replies
// (parent_id) are first-class.

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references((): any => domains.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): any => comments.id, { onDelete: 'cascade' }),
    author: text('author').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('comments_workspace_id_idx').on(table.workspaceId),
    index('comments_entity_idx').on(table.entityType, table.entityId),
    index('comments_parent_id_idx').on(table.parentId),
    index('comments_created_at_idx').on(table.createdAt),
  ]
);

// ── Scheduled Jobs ──────────────────────────────────────────────────────────────

export const scheduledJobs = pgTable(
  'scheduled_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    recurrenceRule: text('recurrence_rule').notNull(),
    nextOccurrenceAt: timestamp('next_occurrence_at', { withTimezone: true }).notNull(),
    lastSpawnedAt: timestamp('last_spawned_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('scheduled_jobs_next_occurrence_idx').on(table.nextOccurrenceAt),
    index('scheduled_jobs_entity_idx').on(table.entityType, table.entityId),
  ]
);

// ── Jobs (Worker Queue) ─────────────────────────────────────────────────────────

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}),
    status: jobStatusEnum('status').notNull().default('pending'),
    attempts: integer('attempts').default(0),
    maxAttempts: integer('max_attempts').default(3),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('jobs_status_idx').on(table.status),
    index('jobs_type_idx').on(table.type),
    index('jobs_next_retry_at_idx').on(table.nextRetryAt),
  ]
);

// ── Webhooks ────────────────────────────────────────────────────────────────────

export const webhooks = pgTable(
  'webhooks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name'),
    url: text('url').notNull(),
    secret: text('secret'),
    events: text('events').array().default([]),
    active: boolean('active').default(true),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references((): any => domains.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('webhooks_workspace_id_idx').on(table.workspaceId),
    index('webhooks_active_idx').on(table.active),
  ]
);

// ── Webhook Deliveries ──────────────────────────────────────────────────────────

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    webhookId: uuid('webhook_id')
      .notNull()
      .references((): any => webhooks.id, { onDelete: 'cascade' }),
    event: text('event').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}),
    status: text('status').notNull().default('pending'),
    statusCode: integer('status_code').default(0),
    responseBody: text('response_body'),
    attempts: integer('attempts').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('webhook_deliveries_webhook_id_idx').on(table.webhookId),
    index('webhook_deliveries_status_idx').on(table.status),
    index('webhook_deliveries_created_at_idx').on(table.createdAt),
  ]
);

// ── API Keys ─────────────────────────────────────────────────────────────────────



// ── Reports ──────────────────────────────────────────────────────────────────

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull().default('Untitled report'),
    content: text('content'),
    reportType: text('report_type').notNull().default('custom'),
    dateRangeStart: timestamp('date_range_start', { withTimezone: true }),
    dateRangeEnd: timestamp('date_range_end', { withTimezone: true }),
    domain: text('domain').notNull().default('personal'),
    projectId: uuid('project_id').references((): any => projects.id, { onDelete: 'set null' }),
    isDraft: boolean('is_draft').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('reports_domain_idx').on(table.domain),
    index('reports_type_idx').on(table.reportType),
    index('reports_created_at_idx').on(table.createdAt),
  ]
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references((): any => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    active: boolean('active').default(true),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('api_keys_user_id_idx').on(table.userId),
    index('api_keys_key_hash_idx').on(table.keyHash),
    index('api_keys_active_idx').on(table.active),
  ]
);

// ── Agents ──────────────────────────────────────────────────────────────────────

export const agents = pgTable(
  'agents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull().default('active'),
    permissionTier: text('permission_tier').notNull().default('read_only'),
    customPermissions: text('custom_permissions').array().default([]),
    apiKey: text('api_key'),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    domainId: uuid('domain_id')
      .notNull()
      .references((): any => domains.id, { onDelete: 'cascade' }),
    tags: text('tags').array().default([]),
    config: jsonb('config').$type<Record<string, unknown>>().default({}),
    customFields: jsonb('custom_fields').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('agents_domain_id_idx').on(table.domainId),
    index('agents_status_idx').on(table.status),
  ]
);

// ── Agent Activity ──────────────────────────────────────────────────────────────

export const agentActivity = pgTable(
  'agent_activity',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: uuid('agent_id')
      .notNull()
      .references((): any => agents.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    details: jsonb('details').$type<Record<string, unknown>>().default({}),
    success: boolean('success').default(true),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('agent_activity_agent_id_idx').on(table.agentId),
    index('agent_activity_created_at_idx').on(table.createdAt),
  ]
);

// ── Agent Tasks ─────────────────────────────────────────────────────────────────

export const agentTasks = pgTable(
  'agent_tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: uuid('agent_id')
      .notNull()
      .references((): any => agents.id, { onDelete: 'cascade' }),
    taskType: text('task_type').notNull(),
    input: jsonb('input').$type<Record<string, unknown>>().default({}),
    status: text('status').notNull().default('pending'),
    output: jsonb('output').$type<Record<string, unknown>>(),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('agent_tasks_agent_id_idx').on(table.agentId),
    index('agent_tasks_status_idx').on(table.status),
  ]
);

// ── Canvases ────────────────────────────────────────────────────────────────────

export const canvases = pgTable(
  'canvases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    mode: text('mode').notNull().default('freeform'),
    domainId: uuid('domain_id')
      .notNull()
      .references((): any => domains.id, { onDelete: 'cascade' }),
    tags: text('tags').array().default([]),
    viewport: jsonb('viewport').$type<{ x: number; y: number; zoom: number }>().default({ x: 0, y: 0, zoom: 1 }),
    background: text('background'),
    customFields: jsonb('custom_fields').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('canvases_domain_id_idx').on(table.domainId),
  ]
);

// ── Canvas Cards ─────────────────────────────────────────────────────────────────

export const canvasCards = pgTable(
  'canvas_cards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    canvasId: uuid('canvas_id')
      .notNull()
      .references((): any => canvases.id, { onDelete: 'cascade' }),
    type: text('type').notNull().default('note'),
    entityId: uuid('entity_id'),
    title: text('title'),
    content: text('content'),
    x: integer('x').default(0),
    y: integer('y').default(0),
    width: integer('width').default(200),
    height: integer('height').default(150),
    rotation: integer('rotation').default(0),
    color: text('color'),
    zIndex: integer('z_index').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('canvas_cards_canvas_id_idx').on(table.canvasId),
  ]
);

// ── Canvas Connections ───────────────────────────────────────────────────────────

export const canvasConnections = pgTable(
  'canvas_connections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    canvasId: uuid('canvas_id')
      .notNull()
      .references((): any => canvases.id, { onDelete: 'cascade' }),
    sourceCardId: uuid('source_card_id')
      .notNull()
      .references((): any => canvasCards.id, { onDelete: 'cascade' }),
    targetCardId: uuid('target_card_id')
      .notNull()
      .references((): any => canvasCards.id, { onDelete: 'cascade' }),
    label: text('label'),
    style: text('style').notNull().default('solid'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('canvas_connections_canvas_id_idx').on(table.canvasId),
  ]
);

// ── Calendar Events ──────────────────────────────────────────────────────────────

export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }),
    allDay: boolean('all_day').default(false),
    color: text('color'),
    domainId: uuid('domain_id')
      .notNull()
      .references((): any => domains.id, { onDelete: 'cascade' }),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    recurrenceRule: text('recurrence_rule'),
    customFields: jsonb('custom_fields').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('calendar_events_domain_id_idx').on(table.domainId),
    index('calendar_events_start_time_idx').on(table.startTime),
    index('calendar_events_end_time_idx').on(table.endTime),
  ]
);

// ── Dashboard Widgets ────────────────────────────────────────────────────────────

export const dashboardWidgets = pgTable(
  'dashboard_widgets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references((): any => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title'),
    config: jsonb('config').$type<Record<string, unknown>>().default({}),
    layout: jsonb('layout').$type<{ x: number; y: number; w: number; h: number }>().default({ x: 0, y: 0, w: 2, h: 2 }),
    domainId: uuid('domain_id')
      .notNull()
      .references((): any => domains.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('dashboard_widgets_user_id_idx').on(table.userId),
    index('dashboard_widgets_domain_id_idx').on(table.domainId),
  ]
);

// ── Daily Notes ──────────────────────────────────────────────────────────────────

export const dailyNotes = pgTable(
  'daily_notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    date: timestamp('date', { withTimezone: true }).notNull(),
    content: text('content'),
    domainId: uuid('domain_id')
      .notNull()
      .references((): any => domains.id, { onDelete: 'cascade' }),
    mood: integer('mood'),
    energy: integer('energy'),
    customFields: jsonb('custom_fields').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('daily_notes_domain_id_idx').on(table.domainId),
    index('daily_notes_date_idx').on(table.date),
    uniqueIndex('daily_notes_date_domain_idx').on(table.date, table.domainId),
  ]
);

// ── Custom Fields ────────────────────────────────────────────────────────────────

export const customFields = pgTable(
  'custom_fields',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    type: text('type').notNull().default('text'),
    entityType: text('entity_type').notNull(),
    domainId: uuid('domain_id')
      .notNull()
      .references((): any => domains.id, { onDelete: 'cascade' }),
    required: boolean('required').default(false),
    options: jsonb('options').$type<string[]>().default([]),
    defaultValue: jsonb('default_value'),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('custom_fields_domain_id_idx').on(table.domainId),
    index('custom_fields_entity_type_idx').on(table.entityType),
  ]
);

// ── Error Logs ───────────────────────────────────────────────────────────────────

export const errorLogs = pgTable(
  'error_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    level: text('level').notNull().default('error'),
    source: text('source').notNull(),
    message: text('message').notNull(),
    stackTrace: text('stack_trace'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    resolved: boolean('resolved').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('error_logs_level_idx').on(table.level),
    index('error_logs_created_at_idx').on(table.createdAt),
    index('error_logs_resolved_idx').on(table.resolved),
  ]
);
