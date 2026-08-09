--
-- PostgreSQL database dump
--

\restrict 2Eem1cQQ8P76XKU1UlapMz16HVQ1nlHhhz9MsVn9AUmmvesR8o23w34mR79UoaV

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: habit_difficulty; Type: TYPE; Schema: public; Owner: project_e
--

CREATE TYPE public.habit_difficulty AS ENUM (
    'easy',
    'medium',
    'hard'
);


ALTER TYPE public.habit_difficulty OWNER TO project_e;

--
-- Name: habit_frequency; Type: TYPE; Schema: public; Owner: project_e
--

CREATE TYPE public.habit_frequency AS ENUM (
    'daily',
    'weekly',
    'custom'
);


ALTER TYPE public.habit_frequency OWNER TO project_e;

--
-- Name: job_status; Type: TYPE; Schema: public; Owner: project_e
--

CREATE TYPE public.job_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed'
);


ALTER TYPE public.job_status OWNER TO project_e;

--
-- Name: project_status; Type: TYPE; Schema: public; Owner: project_e
--

CREATE TYPE public.project_status AS ENUM (
    'active',
    'paused',
    'completed',
    'archived'
);


ALTER TYPE public.project_status OWNER TO project_e;

--
-- Name: section_kind; Type: TYPE; Schema: public; Owner: project_e
--

CREATE TYPE public.section_kind AS ENUM (
    'section',
    'milestone'
);


ALTER TYPE public.section_kind OWNER TO project_e;

--
-- Name: section_status; Type: TYPE; Schema: public; Owner: project_e
--

CREATE TYPE public.section_status AS ENUM (
    'planned',
    'in_progress',
    'complete'
);


ALTER TYPE public.section_status OWNER TO project_e;

--
-- Name: tag_scope; Type: TYPE; Schema: public; Owner: project_e
--

CREATE TYPE public.tag_scope AS ENUM (
    'global',
    'tasks',
    'habits',
    'projects',
    'notes'
);


ALTER TYPE public.tag_scope OWNER TO project_e;

--
-- Name: task_priority; Type: TYPE; Schema: public; Owner: project_e
--

CREATE TYPE public.task_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


ALTER TYPE public.task_priority OWNER TO project_e;

--
-- Name: task_status; Type: TYPE; Schema: public; Owner: project_e
--

CREATE TYPE public.task_status AS ENUM (
    'todo',
    'in_progress',
    'done',
    'cancelled'
);


ALTER TYPE public.task_status OWNER TO project_e;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_feed; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.activity_feed (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor text NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    changes jsonb,
    workspace_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.activity_feed OWNER TO project_e;

--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    key_hash text NOT NULL,
    key_prefix text NOT NULL,
    active boolean DEFAULT true,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.api_keys OWNER TO project_e;

--
-- Name: domains; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.domains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    color text,
    icon text,
    parent_id uuid,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    search_vector tsvector,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    owner_id uuid
);


ALTER TABLE public.domains OWNER TO project_e;

--
-- Name: habit_completions; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.habit_completions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    habit_id uuid NOT NULL,
    date timestamp with time zone NOT NULL,
    value integer DEFAULT 1,
    mood integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.habit_completions OWNER TO project_e;

--
-- Name: habit_tags; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.habit_tags (
    habit_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


ALTER TABLE public.habit_tags OWNER TO project_e;

--
-- Name: habits; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.habits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    domain_id uuid NOT NULL,
    frequency public.habit_frequency DEFAULT 'daily'::public.habit_frequency NOT NULL,
    difficulty public.habit_difficulty DEFAULT 'medium'::public.habit_difficulty NOT NULL,
    goal_per_period integer DEFAULT 1,
    unit text,
    reminder_time time without time zone,
    skip_days integer[] DEFAULT '{}'::integer[],
    streak_count integer DEFAULT 0,
    best_streak integer DEFAULT 0,
    mood_tracking boolean DEFAULT false,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    search_vector tsvector
);


ALTER TABLE public.habits OWNER TO project_e;

--
-- Name: jobs; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb,
    status public.job_status DEFAULT 'pending'::public.job_status NOT NULL,
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    next_retry_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.jobs OWNER TO project_e;

--
-- Name: note_entity_links; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.note_entity_links (
    note_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL
);


ALTER TABLE public.note_entity_links OWNER TO project_e;

--
-- Name: note_links; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.note_links (
    source_note_id uuid NOT NULL,
    target_note_id uuid NOT NULL
);


ALTER TABLE public.note_links OWNER TO project_e;

--
-- Name: note_tags; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.note_tags (
    note_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


ALTER TABLE public.note_tags OWNER TO project_e;

--
-- Name: notes; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    content text,
    domain_id uuid NOT NULL,
    is_pinned boolean DEFAULT false,
    is_archived boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    search_vector tsvector
);


ALTER TABLE public.notes OWNER TO project_e;

--
-- Name: project_tags; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.project_tags (
    project_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


ALTER TABLE public.project_tags OWNER TO project_e;

--
-- Name: projects; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    status public.project_status DEFAULT 'active'::public.project_status NOT NULL,
    domain_id uuid NOT NULL,
    color text,
    icon text,
    target_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    search_vector tsvector
);


ALTER TABLE public.projects OWNER TO project_e;

--
-- Name: scheduled_jobs; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.scheduled_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    recurrence_rule text NOT NULL,
    next_occurrence_at timestamp with time zone NOT NULL,
    last_spawned_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.scheduled_jobs OWNER TO project_e;

--
-- Name: sections; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    project_id uuid NOT NULL,
    kind public.section_kind DEFAULT 'section'::public.section_kind NOT NULL,
    status public.section_status DEFAULT 'planned'::public.section_status NOT NULL,
    target_date timestamp with time zone,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sections OWNER TO project_e;

--
-- Name: tags; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    color text,
    scope public.tag_scope DEFAULT 'global'::public.tag_scope NOT NULL,
    parent_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tags OWNER TO project_e;

--
-- Name: task_dependencies; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.task_dependencies (
    task_id uuid NOT NULL,
    depends_on_task_id uuid NOT NULL
);


ALTER TABLE public.task_dependencies OWNER TO project_e;

--
-- Name: task_tags; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.task_tags (
    task_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


ALTER TABLE public.task_tags OWNER TO project_e;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    status public.task_status DEFAULT 'todo'::public.task_status NOT NULL,
    priority public.task_priority DEFAULT 'medium'::public.task_priority NOT NULL,
    domain_id uuid NOT NULL,
    project_id uuid,
    section_id uuid,
    parent_id uuid,
    due_date timestamp with time zone,
    completed_at timestamp with time zone,
    estimated_minutes integer,
    tracked_minutes integer DEFAULT 0,
    recurrence_rule text,
    "order" integer DEFAULT 0,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    search_vector tsvector
);


ALTER TABLE public.tasks OWNER TO project_e;

--
-- Name: users; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    passkey_credential_id text,
    passkey_public_key text,
    passkey_counter integer DEFAULT 0
);


ALTER TABLE public.users OWNER TO project_e;

--
-- Name: webhook_deliveries; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.webhook_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    webhook_id uuid NOT NULL,
    event text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    status_code integer DEFAULT 0,
    response_body text,
    attempts integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.webhook_deliveries OWNER TO project_e;

--
-- Name: webhooks; Type: TABLE; Schema: public; Owner: project_e
--

CREATE TABLE public.webhooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    url text NOT NULL,
    secret text,
    events text[] DEFAULT '{}'::text[],
    active boolean DEFAULT true,
    workspace_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.webhooks OWNER TO project_e;

--
-- Name: activity_feed activity_feed_pkey; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.activity_feed
    ADD CONSTRAINT activity_feed_pkey PRIMARY KEY (id);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: domains domains_pkey; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_pkey PRIMARY KEY (id);


--
-- Name: domains domains_slug_unique; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_slug_unique UNIQUE (slug);


--
-- Name: habit_completions habit_completions_pkey; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.habit_completions
    ADD CONSTRAINT habit_completions_pkey PRIMARY KEY (id);


--
-- Name: habit_tags habit_tags_habit_id_tag_id_pk; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.habit_tags
    ADD CONSTRAINT habit_tags_habit_id_tag_id_pk PRIMARY KEY (habit_id, tag_id);


--
-- Name: habits habits_pkey; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.habits
    ADD CONSTRAINT habits_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: note_links note_links_source_note_id_target_note_id_pk; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.note_links
    ADD CONSTRAINT note_links_source_note_id_target_note_id_pk PRIMARY KEY (source_note_id, target_note_id);


--
-- Name: note_tags note_tags_note_id_tag_id_pk; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.note_tags
    ADD CONSTRAINT note_tags_note_id_tag_id_pk PRIMARY KEY (note_id, tag_id);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: project_tags project_tags_project_id_tag_id_pk; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.project_tags
    ADD CONSTRAINT project_tags_project_id_tag_id_pk PRIMARY KEY (project_id, tag_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: scheduled_jobs scheduled_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.scheduled_jobs
    ADD CONSTRAINT scheduled_jobs_pkey PRIMARY KEY (id);


--
-- Name: sections sections_pkey; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT sections_pkey PRIMARY KEY (id);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: task_dependencies task_dependencies_task_id_depends_on_task_id_pk; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_task_id_depends_on_task_id_pk PRIMARY KEY (task_id, depends_on_task_id);


--
-- Name: task_tags task_tags_task_id_tag_id_pk; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.task_tags
    ADD CONSTRAINT task_tags_task_id_tag_id_pk PRIMARY KEY (task_id, tag_id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webhook_deliveries webhook_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_pkey PRIMARY KEY (id);


--
-- Name: webhooks webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.webhooks
    ADD CONSTRAINT webhooks_pkey PRIMARY KEY (id);


--
-- Name: activity_feed_actor_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX activity_feed_actor_idx ON public.activity_feed USING btree (actor);


--
-- Name: activity_feed_created_at_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX activity_feed_created_at_idx ON public.activity_feed USING btree (created_at);


--
-- Name: activity_feed_entity_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX activity_feed_entity_idx ON public.activity_feed USING btree (entity_type, entity_id);


--
-- Name: activity_feed_workspace_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX activity_feed_workspace_id_idx ON public.activity_feed USING btree (workspace_id);


--
-- Name: api_keys_active_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX api_keys_active_idx ON public.api_keys USING btree (active);


--
-- Name: api_keys_key_hash_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX api_keys_key_hash_idx ON public.api_keys USING btree (key_hash);


--
-- Name: api_keys_user_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX api_keys_user_id_idx ON public.api_keys USING btree (user_id);


--
-- Name: domains_owner_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX domains_owner_id_idx ON public.domains USING btree (owner_id);


--
-- Name: domains_parent_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX domains_parent_id_idx ON public.domains USING btree (parent_id);


--
-- Name: domains_search_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX domains_search_idx ON public.domains USING gin (search_vector);


--
-- Name: domains_slug_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX domains_slug_idx ON public.domains USING btree (slug);


--
-- Name: habit_completions_date_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX habit_completions_date_idx ON public.habit_completions USING btree (habit_id, date);


--
-- Name: habit_completions_habit_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX habit_completions_habit_id_idx ON public.habit_completions USING btree (habit_id);


--
-- Name: habit_tags_tag_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX habit_tags_tag_id_idx ON public.habit_tags USING btree (tag_id);


--
-- Name: habits_active_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX habits_active_idx ON public.habits USING btree (active);


--
-- Name: habits_deleted_at_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX habits_deleted_at_idx ON public.habits USING btree (deleted_at);


--
-- Name: habits_domain_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX habits_domain_id_idx ON public.habits USING btree (domain_id);


--
-- Name: habits_search_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX habits_search_idx ON public.habits USING gin (search_vector);


--
-- Name: jobs_next_retry_at_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX jobs_next_retry_at_idx ON public.jobs USING btree (next_retry_at);


--
-- Name: jobs_status_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX jobs_status_idx ON public.jobs USING btree (status);


--
-- Name: jobs_type_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX jobs_type_idx ON public.jobs USING btree (type);


--
-- Name: note_entity_links_entity_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX note_entity_links_entity_idx ON public.note_entity_links USING btree (entity_type, entity_id);


--
-- Name: note_entity_links_note_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX note_entity_links_note_id_idx ON public.note_entity_links USING btree (note_id);


--
-- Name: note_links_target_note_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX note_links_target_note_id_idx ON public.note_links USING btree (target_note_id);


--
-- Name: note_tags_tag_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX note_tags_tag_id_idx ON public.note_tags USING btree (tag_id);


--
-- Name: notes_deleted_at_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX notes_deleted_at_idx ON public.notes USING btree (deleted_at);


--
-- Name: notes_domain_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX notes_domain_id_idx ON public.notes USING btree (domain_id);


--
-- Name: notes_is_archived_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX notes_is_archived_idx ON public.notes USING btree (is_archived);


--
-- Name: notes_is_pinned_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX notes_is_pinned_idx ON public.notes USING btree (is_pinned);


--
-- Name: notes_search_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX notes_search_idx ON public.notes USING gin (search_vector);


--
-- Name: project_tags_tag_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX project_tags_tag_id_idx ON public.project_tags USING btree (tag_id);


--
-- Name: projects_deleted_at_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX projects_deleted_at_idx ON public.projects USING btree (deleted_at);


--
-- Name: projects_domain_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX projects_domain_id_idx ON public.projects USING btree (domain_id);


--
-- Name: projects_search_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX projects_search_idx ON public.projects USING gin (search_vector);


--
-- Name: projects_status_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX projects_status_idx ON public.projects USING btree (status);


--
-- Name: scheduled_jobs_entity_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX scheduled_jobs_entity_idx ON public.scheduled_jobs USING btree (entity_type, entity_id);


--
-- Name: scheduled_jobs_next_occurrence_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX scheduled_jobs_next_occurrence_idx ON public.scheduled_jobs USING btree (next_occurrence_at);


--
-- Name: sections_kind_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX sections_kind_idx ON public.sections USING btree (kind);


--
-- Name: sections_project_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX sections_project_id_idx ON public.sections USING btree (project_id);


--
-- Name: sections_sort_order_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX sections_sort_order_idx ON public.sections USING btree (project_id, sort_order);


--
-- Name: tags_parent_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX tags_parent_id_idx ON public.tags USING btree (parent_id);


--
-- Name: tags_scope_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX tags_scope_idx ON public.tags USING btree (scope);


--
-- Name: task_dependencies_depends_on_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX task_dependencies_depends_on_idx ON public.task_dependencies USING btree (depends_on_task_id);


--
-- Name: task_tags_tag_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX task_tags_tag_id_idx ON public.task_tags USING btree (tag_id);


--
-- Name: tasks_deleted_at_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX tasks_deleted_at_idx ON public.tasks USING btree (deleted_at);


--
-- Name: tasks_domain_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX tasks_domain_id_idx ON public.tasks USING btree (domain_id);


--
-- Name: tasks_due_date_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX tasks_due_date_idx ON public.tasks USING btree (due_date);


--
-- Name: tasks_order_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX tasks_order_idx ON public.tasks USING btree ("order");


--
-- Name: tasks_parent_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX tasks_parent_id_idx ON public.tasks USING btree (parent_id);


--
-- Name: tasks_priority_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX tasks_priority_idx ON public.tasks USING btree (priority);


--
-- Name: tasks_project_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX tasks_project_id_idx ON public.tasks USING btree (project_id);


--
-- Name: tasks_search_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX tasks_search_idx ON public.tasks USING gin (search_vector);


--
-- Name: tasks_section_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX tasks_section_id_idx ON public.tasks USING btree (section_id);


--
-- Name: tasks_status_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX tasks_status_idx ON public.tasks USING btree (status);


--
-- Name: webhook_deliveries_created_at_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX webhook_deliveries_created_at_idx ON public.webhook_deliveries USING btree (created_at);


--
-- Name: webhook_deliveries_status_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX webhook_deliveries_status_idx ON public.webhook_deliveries USING btree (status);


--
-- Name: webhook_deliveries_webhook_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX webhook_deliveries_webhook_id_idx ON public.webhook_deliveries USING btree (webhook_id);


--
-- Name: webhooks_active_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX webhooks_active_idx ON public.webhooks USING btree (active);


--
-- Name: webhooks_workspace_id_idx; Type: INDEX; Schema: public; Owner: project_e
--

CREATE INDEX webhooks_workspace_id_idx ON public.webhooks USING btree (workspace_id);


--
-- Name: activity_feed activity_feed_workspace_id_domains_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.activity_feed
    ADD CONSTRAINT activity_feed_workspace_id_domains_id_fk FOREIGN KEY (workspace_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: api_keys api_keys_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: domains domains_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: domains domains_parent_id_domains_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_parent_id_domains_id_fk FOREIGN KEY (parent_id) REFERENCES public.domains(id) ON DELETE SET NULL;


--
-- Name: habit_completions habit_completions_habit_id_habits_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.habit_completions
    ADD CONSTRAINT habit_completions_habit_id_habits_id_fk FOREIGN KEY (habit_id) REFERENCES public.habits(id) ON DELETE CASCADE;


--
-- Name: habit_tags habit_tags_habit_id_habits_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.habit_tags
    ADD CONSTRAINT habit_tags_habit_id_habits_id_fk FOREIGN KEY (habit_id) REFERENCES public.habits(id) ON DELETE CASCADE;


--
-- Name: habit_tags habit_tags_tag_id_tags_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.habit_tags
    ADD CONSTRAINT habit_tags_tag_id_tags_id_fk FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: habits habits_domain_id_domains_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.habits
    ADD CONSTRAINT habits_domain_id_domains_id_fk FOREIGN KEY (domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: note_entity_links note_entity_links_note_id_notes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.note_entity_links
    ADD CONSTRAINT note_entity_links_note_id_notes_id_fk FOREIGN KEY (note_id) REFERENCES public.notes(id) ON DELETE CASCADE;


--
-- Name: note_links note_links_source_note_id_notes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.note_links
    ADD CONSTRAINT note_links_source_note_id_notes_id_fk FOREIGN KEY (source_note_id) REFERENCES public.notes(id) ON DELETE CASCADE;


--
-- Name: note_links note_links_target_note_id_notes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.note_links
    ADD CONSTRAINT note_links_target_note_id_notes_id_fk FOREIGN KEY (target_note_id) REFERENCES public.notes(id) ON DELETE CASCADE;


--
-- Name: note_tags note_tags_note_id_notes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.note_tags
    ADD CONSTRAINT note_tags_note_id_notes_id_fk FOREIGN KEY (note_id) REFERENCES public.notes(id) ON DELETE CASCADE;


--
-- Name: note_tags note_tags_tag_id_tags_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.note_tags
    ADD CONSTRAINT note_tags_tag_id_tags_id_fk FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: notes notes_domain_id_domains_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_domain_id_domains_id_fk FOREIGN KEY (domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: project_tags project_tags_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.project_tags
    ADD CONSTRAINT project_tags_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_tags project_tags_tag_id_tags_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.project_tags
    ADD CONSTRAINT project_tags_tag_id_tags_id_fk FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: projects projects_domain_id_domains_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_domain_id_domains_id_fk FOREIGN KEY (domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: sections sections_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT sections_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: tags tags_parent_id_tags_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_parent_id_tags_id_fk FOREIGN KEY (parent_id) REFERENCES public.tags(id) ON DELETE SET NULL;


--
-- Name: task_dependencies task_dependencies_depends_on_task_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_depends_on_task_id_tasks_id_fk FOREIGN KEY (depends_on_task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_dependencies task_dependencies_task_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_tags task_tags_tag_id_tags_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.task_tags
    ADD CONSTRAINT task_tags_tag_id_tags_id_fk FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: task_tags task_tags_task_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.task_tags
    ADD CONSTRAINT task_tags_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_domain_id_domains_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_domain_id_domains_id_fk FOREIGN KEY (domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_parent_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_parent_id_tasks_id_fk FOREIGN KEY (parent_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_section_id_sections_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_section_id_sections_id_fk FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE SET NULL;


--
-- Name: webhook_deliveries webhook_deliveries_webhook_id_webhooks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_webhook_id_webhooks_id_fk FOREIGN KEY (webhook_id) REFERENCES public.webhooks(id) ON DELETE CASCADE;


--
-- Name: webhooks webhooks_workspace_id_domains_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: project_e
--

ALTER TABLE ONLY public.webhooks
    ADD CONSTRAINT webhooks_workspace_id_domains_id_fk FOREIGN KEY (workspace_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 2Eem1cQQ8P76XKU1UlapMz16HVQ1nlHhhz9MsVn9AUmmvesR8o23w34mR79UoaV

