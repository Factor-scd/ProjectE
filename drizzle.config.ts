import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './packages/db/src/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://project_e:project_e@localhost:5432/project_e',
  },
});
