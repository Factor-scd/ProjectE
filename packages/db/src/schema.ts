import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Collection data is intentionally stored as JSONB. The application has flexible
// per-collection fields, and this preserves that shape while PostgreSQL owns storage.
export const records = pgTable(
  'records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    collection: text('collection').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('records_collection_created_at_idx').on(table.collection, table.createdAt)]
);
