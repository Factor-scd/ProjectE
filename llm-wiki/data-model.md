# Data Model

## Entity Relationship Overview

- **domains** — Workspaces (parent_id=null) and sub-groups
- **tasks** — Rich task model with subtasks, dependencies, time tracking
- **habits** — Habit tracking with streaks, mood, reminders
- **projects** — Projects with sections (milestones)
- **notes** — Markdown notes with wikilinks and backlinks
- **tags** — Universal tags with entity scoping and hierarchy
- **activity_feed** — Append-only audit log
- **scheduled_jobs** — Recurring task/habit spawning
- **jobs** — Worker queue
- **webhooks** — Registered webhook endpoints

## Key Design Decisions

- Soft-delete via `deleted_at` on all user data tables
- UUID primary keys with `gen_random_uuid()`
- Text enums via `pgEnum` for status/priority/type fields
- JSONB for flexible data (custom_fields, changes, payload)
- All entities scoped to a workspace via `domain_id` or `workspace_id`

## Junction Tables

- task_tags, habit_tags, note_tags, project_tags — many-to-many entity↔tag
- task_dependencies — task dependency graph
- note_links — wikilink/backlink connections
- note_entity_links — cross-entity linking (note → task/habit/project)

## Indexes

Every FK column and frequently filtered column has an index. See `packages/db/src/schema.ts` for the full list.
