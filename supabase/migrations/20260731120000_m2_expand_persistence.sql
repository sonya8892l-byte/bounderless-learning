-- M2 expand migration.
--
-- This migration deliberately keeps the legacy learner_sessions.payload column
-- and runtime_state table. The legacy course-runs JSON document is seeded when
-- absent, but is never parsed or backfilled implicitly. Normalized runtime data
-- can therefore be populated and validated in a later backfill/cutover release.

begin;

-- ---------------------------------------------------------------------------
-- Legacy compatibility state
-- ---------------------------------------------------------------------------

create table if not exists public.runtime_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.runtime_state
  add column if not exists payload jsonb,
  add column if not exists updated_at timestamptz not null default now();

update public.runtime_state
set payload = '{}'::jsonb
where payload is null;

alter table public.runtime_state
  alter column payload set not null,
  alter column updated_at set default now();

insert into public.runtime_state (id, payload, updated_at)
values (
  'course-runs',
  '{
    "schemaVersion": 1,
    "sequence": 0,
    "runs": [],
    "alerts": [],
    "commands": [],
    "receipts": [],
    "interventions": [],
    "auditEvents": [],
    "events": []
  }'::jsonb,
  now()
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Course runs, groups, and participant seats
-- ---------------------------------------------------------------------------

create table if not exists public.course_runs (
  id text primary key,
  teacher_id text,
  owner_user_id text,
  course_id text not null,
  course_version text not null default '1.0.0',
  class_name text not null default '',
  status text not null default 'draft',
  phase_id text,
  version integer not null default 1,
  state_version bigint not null default 1,
  entry_code_digest text,
  join_expires_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.course_runs
  add column if not exists teacher_id text,
  add column if not exists owner_user_id text,
  add column if not exists course_id text,
  add column if not exists course_version text,
  add column if not exists class_name text,
  add column if not exists status text,
  add column if not exists phase_id text,
  add column if not exists version integer not null default 1,
  add column if not exists state_version bigint not null default 1,
  add column if not exists entry_code_digest text,
  add column if not exists join_expires_at timestamptz,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- A previous schema called the owner teacher_id and the version column version.
-- These scalar copies are safe; the runtime_state JSON document remains opaque.
update public.course_runs
set owner_user_id = teacher_id
where owner_user_id is null
  and teacher_id is not null;

update public.course_runs
set state_version = greatest(state_version, version::bigint)
where version is not null;

alter table public.course_runs
  alter column teacher_id drop not null,
  alter column course_version set default '1.0.0',
  alter column class_name set default '',
  alter column status set default 'draft',
  alter column version set default 1,
  alter column state_version set default 1,
  alter column payload set default '{}'::jsonb,
  alter column created_at set default now(),
  alter column updated_at set default now();

create table if not exists public.run_groups (
  id text primary key,
  run_id text not null,
  external_key text not null,
  name text not null,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.participants (
  id text primary key,
  run_id text not null,
  group_id text not null,
  external_key text,
  role_id text not null,
  display_name text,
  auth_user_id uuid,
  claimed_at timestamptz,
  status text not null default 'unclaimed',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Learner state and idempotent AI requests
-- ---------------------------------------------------------------------------

create table if not exists public.learner_sessions (
  id text primary key,
  payload jsonb not null,
  state_version bigint not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  run_id text,
  participant_id text,
  auth_user_id uuid,
  course_id text,
  role_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- run_id and participant_id intentionally remain unconstrained during expand:
-- legacy sessions can refer to participant data that still lives only inside
-- runtime_state. Add and validate those foreign keys after explicit backfill.
alter table public.learner_sessions
  add column if not exists payload jsonb,
  add column if not exists state_version bigint not null default 1,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists run_id text,
  add column if not exists participant_id text,
  add column if not exists auth_user_id uuid,
  add column if not exists course_id text,
  add column if not exists role_id text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.learner_sessions
set payload = '{}'::jsonb
where payload is null;

update public.learner_sessions
set state_version = 1
where state_version is null
   or state_version < 1;

update public.learner_sessions
set metadata = '{}'::jsonb
where metadata is null;

-- The legacy schema only had updated_at. It is a closer lower-bound for the
-- original creation time than stamping every migrated row at migration time.
update public.learner_sessions
set created_at = coalesce(updated_at, now())
where created_at is null;

alter table public.learner_sessions
  alter column payload set not null,
  alter column state_version set default 1,
  alter column state_version set not null,
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now();

create table if not exists public.learner_requests (
  session_id text not null,
  request_id text not null,
  request_digest text not null,
  status text not null,
  lease_token uuid,
  lease_owner text,
  lease_expires_at timestamptz,
  attempt_count integer not null default 1,
  result jsonb,
  error jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (session_id, request_id)
);

-- ---------------------------------------------------------------------------
-- Presence, ordered events, commands, and delivery receipts
-- ---------------------------------------------------------------------------

create table if not exists public.participant_presence (
  participant_id text primary key,
  run_id text not null,
  online boolean not null default false,
  network_status text,
  location_permission text,
  camera_permission text,
  longitude double precision,
  latitude double precision,
  accuracy_meters double precision,
  inside_fence boolean,
  progress numeric(5, 2),
  current_task text,
  idle_seconds integer not null default 0,
  scaffold_level integer not null default 0,
  time_balance integer not null default 0,
  evidence_count integer not null default 0,
  device jsonb not null default '{}'::jsonb,
  location jsonb not null default '{}'::jsonb,
  learning jsonb not null default '{}'::jsonb,
  observed_at timestamptz,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.run_events (
  sequence bigserial primary key,
  run_id text not null,
  type text not null,
  audience_type text not null default 'run',
  audience_id text,
  topic text not null default 'runtime',
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.run_events
  add column if not exists audience_type text not null default 'run',
  add column if not exists audience_id text,
  add column if not exists topic text not null default 'runtime',
  add column if not exists entity_id text,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.teacher_commands (
  id text primary key,
  run_id text not null,
  sequence bigint,
  idempotency_key text not null,
  actor_id text not null,
  action text not null,
  target jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  expected_version bigint,
  status text not null default 'accepted',
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.teacher_commands
  add column if not exists sequence bigint,
  add column if not exists expected_version bigint,
  add column if not exists reason text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists completed_at timestamptz;

create table if not exists public.command_deliveries (
  id text primary key,
  run_id text not null,
  command_id text not null,
  participant_id text not null,
  learner_session_id text,
  status text not null default 'accepted',
  delivery_attempts integer not null default 0,
  accepted_at timestamptz not null default now(),
  delivered_at timestamptz,
  confirmed_at timestamptz,
  failed_at timestamptz,
  last_error jsonb,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Alerts, interventions, and append-only audit records
-- ---------------------------------------------------------------------------

create table if not exists public.alerts (
  id text primary key,
  run_id text not null,
  participant_id text,
  group_id text,
  severity text not null,
  type text not null,
  title text,
  status text not null default 'open',
  context jsonb not null default '{}'::jsonb,
  resolution text,
  dedupe_key text,
  state_version bigint not null default 1,
  acknowledged_by text,
  acknowledged_at timestamptz,
  resolved_by text,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.alerts
  add column if not exists title text,
  add column if not exists resolution text,
  add column if not exists dedupe_key text,
  add column if not exists state_version bigint not null default 1,
  add column if not exists acknowledged_by text,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists resolved_by text,
  add column if not exists resolved_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.teacher_interventions (
  id text primary key,
  run_id text not null,
  command_id text,
  actor_id text not null,
  action text not null,
  target jsonb not null default '{}'::jsonb,
  reason text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id text primary key,
  run_id text not null,
  actor_id text not null,
  action text not null,
  subject jsonb not null default '{}'::jsonb,
  reason text,
  payload jsonb not null default '{}'::jsonb,
  request_id text,
  ip_hash text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_events
  add column if not exists request_id text,
  add column if not exists ip_hash text,
  add column if not exists user_agent text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Candidate keys required by the composite foreign keys below.
create unique index if not exists run_groups_run_id_id_uidx
  on public.run_groups (run_id, id);

create unique index if not exists participants_run_id_id_uidx
  on public.participants (run_id, id);

create unique index if not exists learner_sessions_run_id_id_uidx
  on public.learner_sessions (run_id, id);

create unique index if not exists teacher_commands_run_id_id_uidx
  on public.teacher_commands (run_id, id);

-- ---------------------------------------------------------------------------
-- Domain constraints and relationships
--
-- Foreign keys are NOT VALID in this expand release. They protect all new
-- writes immediately while allowing a later explicit backfill/validation step
-- to deal with any pre-existing rows.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.course_runs'::regclass
      and conname = 'course_runs_status_check'
  ) then
    alter table public.course_runs
      add constraint course_runs_status_check
      check (status in ('draft', 'ready', 'active', 'paused', 'completed', 'cancelled', 'archived'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.course_runs'::regclass
      and conname = 'course_runs_state_version_check'
  ) then
    alter table public.course_runs
      add constraint course_runs_state_version_check
      check (state_version >= 1)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.run_groups'::regclass
      and conname = 'run_groups_run_id_fkey'
  ) then
    alter table public.run_groups
      add constraint run_groups_run_id_fkey
      foreign key (run_id) references public.course_runs(id) on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.participants'::regclass
      and conname = 'participants_run_id_fkey'
  ) then
    alter table public.participants
      add constraint participants_run_id_fkey
      foreign key (run_id) references public.course_runs(id) on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.participants'::regclass
      and conname = 'participants_group_fkey'
  ) then
    alter table public.participants
      add constraint participants_group_fkey
      foreign key (run_id, group_id)
      references public.run_groups(run_id, id) on delete restrict
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.participants'::regclass
      and conname = 'participants_status_check'
  ) then
    alter table public.participants
      add constraint participants_status_check
      check (status in ('unclaimed', 'claimed', 'active', 'offline', 'completed', 'withdrawn'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.learner_sessions'::regclass
      and conname = 'learner_sessions_state_version_check'
  ) then
    alter table public.learner_sessions
      add constraint learner_sessions_state_version_check
      check (state_version >= 1)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.learner_requests'::regclass
      and conname = 'learner_requests_session_id_fkey'
  ) then
    alter table public.learner_requests
      add constraint learner_requests_session_id_fkey
      foreign key (session_id) references public.learner_sessions(id) on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.learner_requests'::regclass
      and conname = 'learner_requests_status_check'
  ) then
    alter table public.learner_requests
      add constraint learner_requests_status_check
      check (status in ('processing', 'completed', 'failed'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.learner_requests'::regclass
      and conname = 'learner_requests_attempt_count_check'
  ) then
    alter table public.learner_requests
      add constraint learner_requests_attempt_count_check
      check (attempt_count >= 1)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.learner_requests'::regclass
      and conname = 'learner_requests_processing_lease_check'
  ) then
    alter table public.learner_requests
      add constraint learner_requests_processing_lease_check
      check (
        status <> 'processing'
        or (lease_token is not null and lease_expires_at is not null)
      )
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.participant_presence'::regclass
      and conname = 'participant_presence_participant_fkey'
  ) then
    alter table public.participant_presence
      add constraint participant_presence_participant_fkey
      foreign key (run_id, participant_id)
      references public.participants(run_id, id) on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.participant_presence'::regclass
      and conname = 'participant_presence_coordinates_check'
  ) then
    alter table public.participant_presence
      add constraint participant_presence_coordinates_check
      check (
        (longitude is null or longitude between -180 and 180)
        and (latitude is null or latitude between -90 and 90)
        and (accuracy_meters is null or accuracy_meters >= 0)
      )
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.participant_presence'::regclass
      and conname = 'participant_presence_learning_check'
  ) then
    alter table public.participant_presence
      add constraint participant_presence_learning_check
      check (
        (progress is null or progress between 0 and 100)
        and idle_seconds >= 0
        and scaffold_level >= 0
        and evidence_count >= 0
      )
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.run_events'::regclass
      and conname = 'run_events_run_id_fkey'
  ) then
    alter table public.run_events
      add constraint run_events_run_id_fkey
      foreign key (run_id) references public.course_runs(id) on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.run_events'::regclass
      and conname = 'run_events_audience_type_check'
  ) then
    alter table public.run_events
      add constraint run_events_audience_type_check
      check (audience_type in ('run', 'group', 'role', 'participant', 'teacher', 'topic'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.teacher_commands'::regclass
      and conname = 'teacher_commands_run_id_fkey'
  ) then
    alter table public.teacher_commands
      add constraint teacher_commands_run_id_fkey
      foreign key (run_id) references public.course_runs(id) on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.teacher_commands'::regclass
      and conname = 'teacher_commands_status_check'
  ) then
    alter table public.teacher_commands
      add constraint teacher_commands_status_check
      check (
        status in (
          'queued', 'accepted', 'delivered', 'partially_delivered',
          'completed', 'failed', 'cancelled'
        )
      )
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.command_deliveries'::regclass
      and conname = 'command_deliveries_command_fkey'
  ) then
    alter table public.command_deliveries
      add constraint command_deliveries_command_fkey
      foreign key (run_id, command_id)
      references public.teacher_commands(run_id, id) on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.command_deliveries'::regclass
      and conname = 'command_deliveries_participant_fkey'
  ) then
    alter table public.command_deliveries
      add constraint command_deliveries_participant_fkey
      foreign key (run_id, participant_id)
      references public.participants(run_id, id) on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.command_deliveries'::regclass
      and conname = 'command_deliveries_session_fkey'
  ) then
    alter table public.command_deliveries
      add constraint command_deliveries_session_fkey
      foreign key (run_id, learner_session_id)
      references public.learner_sessions(run_id, id) on delete restrict
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.command_deliveries'::regclass
      and conname = 'command_deliveries_status_check'
  ) then
    alter table public.command_deliveries
      add constraint command_deliveries_status_check
      check (status in ('accepted', 'pending', 'delivered', 'confirmed', 'failed', 'skipped'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.command_deliveries'::regclass
      and conname = 'command_deliveries_attempts_check'
  ) then
    alter table public.command_deliveries
      add constraint command_deliveries_attempts_check
      check (delivery_attempts >= 0)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.alerts'::regclass
      and conname = 'alerts_run_id_fkey'
  ) then
    alter table public.alerts
      add constraint alerts_run_id_fkey
      foreign key (run_id) references public.course_runs(id) on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.alerts'::regclass
      and conname = 'alerts_participant_fkey'
  ) then
    alter table public.alerts
      add constraint alerts_participant_fkey
      foreign key (run_id, participant_id)
      references public.participants(run_id, id) on delete restrict
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.alerts'::regclass
      and conname = 'alerts_group_fkey'
  ) then
    alter table public.alerts
      add constraint alerts_group_fkey
      foreign key (run_id, group_id)
      references public.run_groups(run_id, id) on delete restrict
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.alerts'::regclass
      and conname = 'alerts_severity_check'
  ) then
    alter table public.alerts
      add constraint alerts_severity_check
      check (severity in ('P0', 'P1', 'P2', 'P3'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.alerts'::regclass
      and conname = 'alerts_status_check'
  ) then
    alter table public.alerts
      add constraint alerts_status_check
      check (status in ('open', 'acknowledged', 'in_progress', 'resolved', 'false_alarm', 'dismissed'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.alerts'::regclass
      and conname = 'alerts_state_version_check'
  ) then
    alter table public.alerts
      add constraint alerts_state_version_check
      check (state_version >= 1)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.teacher_interventions'::regclass
      and conname = 'teacher_interventions_run_id_fkey'
  ) then
    alter table public.teacher_interventions
      add constraint teacher_interventions_run_id_fkey
      foreign key (run_id) references public.course_runs(id) on delete cascade
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.teacher_interventions'::regclass
      and conname = 'teacher_interventions_command_fkey'
  ) then
    alter table public.teacher_interventions
      add constraint teacher_interventions_command_fkey
      foreign key (run_id, command_id)
      references public.teacher_commands(run_id, id) on delete restrict
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.audit_events'::regclass
      and conname = 'audit_events_run_id_fkey'
  ) then
    alter table public.audit_events
      add constraint audit_events_run_id_fkey
      foreign key (run_id) references public.course_runs(id) on delete restrict
      not valid;
  end if;
end;
$$;

-- Unique indexes also provide the candidate keys used by composite foreign
-- keys. Group and participant IDs remain globally unique, while the composite
-- keys prevent accidental cross-run relationships.
create unique index if not exists run_groups_run_external_key_uidx
  on public.run_groups (run_id, external_key);

create unique index if not exists participants_group_role_uidx
  on public.participants (group_id, role_id);

create unique index if not exists participants_run_auth_user_uidx
  on public.participants (run_id, auth_user_id)
  where auth_user_id is not null;

create unique index if not exists learner_requests_one_processing_per_session_uidx
  on public.learner_requests (session_id)
  where status = 'processing';

create unique index if not exists teacher_commands_run_idempotency_uidx
  on public.teacher_commands (run_id, idempotency_key);

create unique index if not exists teacher_commands_run_sequence_uidx
  on public.teacher_commands (run_id, sequence)
  where sequence is not null;

create unique index if not exists command_deliveries_command_participant_uidx
  on public.command_deliveries (command_id, participant_id);

create unique index if not exists alerts_run_dedupe_uidx
  on public.alerts (run_id, dedupe_key)
  where dedupe_key is not null;

-- Query and cursor indexes.
create index if not exists runtime_state_updated_at_idx
  on public.runtime_state (updated_at desc);

create index if not exists course_runs_owner_status_updated_idx
  on public.course_runs (owner_user_id, status, updated_at desc);

create index if not exists course_runs_course_status_idx
  on public.course_runs (course_id, status);

create index if not exists run_groups_run_sort_idx
  on public.run_groups (run_id, sort_order, id);

create index if not exists participants_run_status_idx
  on public.participants (run_id, status, id);

create index if not exists participants_run_group_idx
  on public.participants (run_id, group_id, role_id);

create index if not exists learner_sessions_run_participant_idx
  on public.learner_sessions (run_id, participant_id);

create index if not exists learner_sessions_auth_user_updated_idx
  on public.learner_sessions (auth_user_id, updated_at desc)
  where auth_user_id is not null;

create index if not exists learner_sessions_updated_at_idx
  on public.learner_sessions (updated_at desc);

create index if not exists learner_requests_active_lease_idx
  on public.learner_requests (lease_expires_at, session_id)
  where status = 'processing';

create index if not exists learner_requests_session_updated_idx
  on public.learner_requests (session_id, updated_at desc);

create index if not exists participant_presence_run_seen_idx
  on public.participant_presence (run_id, last_seen_at desc);

create index if not exists participant_presence_run_online_idx
  on public.participant_presence (run_id, online, updated_at desc);

create index if not exists run_events_run_sequence_idx
  on public.run_events (run_id, sequence);

create index if not exists run_events_run_audience_sequence_idx
  on public.run_events (run_id, audience_type, audience_id, sequence);

create index if not exists run_events_run_topic_sequence_idx
  on public.run_events (run_id, topic, sequence);

create index if not exists teacher_commands_run_status_created_idx
  on public.teacher_commands (run_id, status, created_at desc);

create index if not exists command_deliveries_participant_status_idx
  on public.command_deliveries (participant_id, status, updated_at desc);

create index if not exists command_deliveries_session_status_idx
  on public.command_deliveries (learner_session_id, status, updated_at desc)
  where learner_session_id is not null;

create index if not exists command_deliveries_run_session_idx
  on public.command_deliveries (run_id, learner_session_id)
  where learner_session_id is not null;

create index if not exists alerts_run_status_severity_created_idx
  on public.alerts (run_id, status, severity, created_at desc);

create index if not exists alerts_run_group_idx
  on public.alerts (run_id, group_id)
  where group_id is not null;

create index if not exists alerts_participant_status_idx
  on public.alerts (participant_id, status, created_at desc)
  where participant_id is not null;

create index if not exists teacher_interventions_run_created_idx
  on public.teacher_interventions (run_id, created_at desc);

create index if not exists teacher_interventions_run_command_idx
  on public.teacher_interventions (run_id, command_id)
  where command_id is not null;

create index if not exists audit_events_run_created_idx
  on public.audit_events (run_id, created_at desc);

create index if not exists audit_events_actor_created_idx
  on public.audit_events (actor_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Supabase exposure boundary
-- ---------------------------------------------------------------------------

alter table public.runtime_state enable row level security;
alter table public.course_runs enable row level security;
alter table public.run_groups enable row level security;
alter table public.participants enable row level security;
alter table public.learner_sessions enable row level security;
alter table public.learner_requests enable row level security;
alter table public.participant_presence enable row level security;
alter table public.run_events enable row level security;
alter table public.teacher_commands enable row level security;
alter table public.command_deliveries enable row level security;
alter table public.alerts enable row level security;
alter table public.teacher_interventions enable row level security;
alter table public.audit_events enable row level security;

-- M2 server traffic uses a private PostgreSQL connection. Browser roles receive
-- no direct table or sequence privileges until M3 adds Auth-aware RLS policies.
-- Supabase defines anon/authenticated; a plain PostgreSQL CI database may not.
do $$
declare
  browser_role text;
  relation_name text;
begin
  foreach browser_role in array array['anon', 'authenticated'] loop
    if exists (
      select 1
      from pg_roles
      where rolname = browser_role
    ) then
      foreach relation_name in array array[
        'runtime_state',
        'course_runs',
        'run_groups',
        'participants',
        'learner_sessions',
        'learner_requests',
        'participant_presence',
        'run_events',
        'teacher_commands',
        'command_deliveries',
        'alerts',
        'teacher_interventions',
        'audit_events'
      ] loop
        execute format(
          'revoke all privileges on table public.%I from %I',
          relation_name,
          browser_role
        );
      end loop;

      if to_regclass('public.run_events_sequence_seq') is not null then
        execute format(
          'revoke all privileges on sequence public.run_events_sequence_seq from %I',
          browser_role
        );
      end if;
    end if;
  end loop;
end;
$$;

comment on table public.runtime_state is
  'Legacy compatibility only. Do not add new aggregate runtime state here after cutover.';
comment on column public.learner_sessions.payload is
  'Opaque learner Agent state retained for backward-compatible session persistence.';
comment on table public.learner_requests is
  'Idempotency result cache and expiring lease for AI turns.';
comment on table public.audit_events is
  'Append-only application audit log; browser roles have no direct privileges.';

commit;
