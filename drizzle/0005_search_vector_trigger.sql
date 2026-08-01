-- T14/Bug #3 HIGH: Populate tsvector search_vector on every INSERT / UPDATE.
--
-- The schema defines searchVector columns on domains / projects / tasks /
-- habits / notes but the columns are never populated, so /api/search
-- always returns zero results. This migration:
--   1. Creates a single plpgsql trigger function that builds the tsvector
--      from the table's title-like and content-like text columns.
--   2. Installs BEFORE INSERT OR UPDATE triggers on each searchable table.
--   3. Backfills existing rows so they appear in search immediately.

-- ─── Per-table tsvector field lists ─────────────────────────────────────
-- We can't share one trigger function across tables with different column
-- names, so each table gets its own function. PostgreSQL's CREATE OR
-- REPLACE FUNCTION is idempotent — re-running this migration is safe.

-- domains: name only (no description column)
CREATE OR REPLACE FUNCTION project_e_search_vector_domains_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.name, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- projects: name + description
CREATE OR REPLACE FUNCTION project_e_search_vector_projects_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.name, '') || ' ' || coalesce(NEW.description, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- tasks: title + description
CREATE OR REPLACE FUNCTION project_e_search_vector_tasks_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- habits: name + description
CREATE OR REPLACE FUNCTION project_e_search_vector_habits_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.name, '') || ' ' || coalesce(NEW.description, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- notes: title + content
CREATE OR REPLACE FUNCTION project_e_search_vector_notes_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' || coalesce(NEW.content, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- ─── Per-table triggers (BEFORE INSERT OR UPDATE) ───────────────────────
DROP TRIGGER IF EXISTS domains_search_vector_trigger ON domains;
CREATE TRIGGER domains_search_vector_trigger
  BEFORE INSERT OR UPDATE ON domains
  FOR EACH ROW EXECUTE FUNCTION project_e_search_vector_domains_update();

DROP TRIGGER IF EXISTS projects_search_vector_trigger ON projects;
CREATE TRIGGER projects_search_vector_trigger
  BEFORE INSERT OR UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION project_e_search_vector_projects_update();

DROP TRIGGER IF EXISTS tasks_search_vector_trigger ON tasks;
CREATE TRIGGER tasks_search_vector_trigger
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION project_e_search_vector_tasks_update();

DROP TRIGGER IF EXISTS habits_search_vector_trigger ON habits;
CREATE TRIGGER habits_search_vector_trigger
  BEFORE INSERT OR UPDATE ON habits
  FOR EACH ROW EXECUTE FUNCTION project_e_search_vector_habits_update();

DROP TRIGGER IF EXISTS notes_search_vector_trigger ON notes;
CREATE TRIGGER notes_search_vector_trigger
  BEFORE INSERT OR UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION project_e_search_vector_notes_update();

-- ─── Backfill existing rows ─────────────────────────────────────────────
-- Use IS NOT NULL guard on text columns so blank rows are skipped silently.
-- to_tsvector returns an empty tsvector ('') for blank input — harmless.
UPDATE domains    SET search_vector = to_tsvector('english', coalesce(name, ''));
UPDATE projects   SET search_vector = to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,''));
UPDATE tasks      SET search_vector = to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''));
UPDATE habits     SET search_vector = to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,''));
UPDATE notes      SET search_vector = to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,''));
