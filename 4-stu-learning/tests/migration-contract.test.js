import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const TESTS_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(TESTS_ROOT, '../..');
const MIGRATION_PATH = path.join(
  REPOSITORY_ROOT,
  'supabase/migrations/20260731120000_m2_expand_persistence.sql',
);

const REQUIRED_TABLES = [
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
  'audit_events',
];

const migrationSql = await fs.readFile(MIGRATION_PATH, 'utf8');

function escaped(value) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tableDefinition(tableName) {
  const match = migrationSql.match(new RegExp(
    `create table if not exists public\\.${escaped(tableName)} \\(([\\s\\S]*?)\\n\\);`,
    'i',
  ));
  assert.ok(match, `migration 应创建 public.${tableName}`);
  return match[1];
}

test('M2 migration 保留旧状态并创建完整持久化表', () => {
  for (const tableName of REQUIRED_TABLES) {
    tableDefinition(tableName);
  }

  const runtimeState = tableDefinition('runtime_state');
  assert.match(runtimeState, /\bid text primary key\b/i);
  assert.match(runtimeState, /\bpayload jsonb not null\b/i);
  assert.match(runtimeState, /\bupdated_at timestamptz not null\b/i);
  assert.match(
    migrationSql,
    /insert into public\.runtime_state[\s\S]*?'course-runs'[\s\S]*?on conflict \(id\) do nothing;/i,
  );

  const learnerSessions = tableDefinition('learner_sessions');
  assert.match(learnerSessions, /\bpayload jsonb not null\b/i);
  assert.match(learnerSessions, /\bstate_version bigint not null default 1\b/i);
  assert.match(learnerSessions, /\bmetadata jsonb not null default '\{\}'::jsonb\b/i);
  for (const column of [
    'run_id text',
    'participant_id text',
    'auth_user_id uuid',
    'course_id text',
    'role_id text',
  ]) {
    assert.match(learnerSessions, new RegExp(`\\b${escaped(column)}\\b`, 'i'));
  }

  const learnerRequests = tableDefinition('learner_requests');
  for (const column of [
    'request_digest text not null',
    'lease_token uuid',
    'lease_owner text',
    'lease_expires_at timestamptz',
    'attempt_count integer not null default 1',
    'result jsonb',
    'error jsonb',
    'completed_at timestamptz',
  ]) {
    assert.match(learnerRequests, new RegExp(`\\b${escaped(column)}\\b`, 'i'));
  }
  assert.match(learnerRequests, /\bprimary key \(session_id, request_id\)/i);
  assert.match(
    migrationSql,
    /on public\.learner_requests \(session_id\)\s+where status = 'processing';/i,
  );
  assert.match(migrationSql, /learner_requests_processing_lease_check/i);
});

test('所有公开业务表启用 RLS，浏览器角色撤权兼容普通 PostgreSQL', () => {
  const revokeListMatch = migrationSql.match(
    /foreach relation_name in array array\[([\s\S]*?)\]\s*loop/i,
  );
  assert.ok(revokeListMatch, 'migration 应声明受保护表的撤权清单');
  const revokeTables = [...revokeListMatch[1].matchAll(/'([a-z_]+)'/g)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(revokeTables, [...REQUIRED_TABLES].sort());

  for (const tableName of REQUIRED_TABLES) {
    assert.match(
      migrationSql,
      new RegExp(
        `alter table public\\.${escaped(tableName)} enable row level security;`,
        'i',
      ),
      `${tableName} 应启用 RLS`,
    );
  }

  assert.match(
    migrationSql,
    /foreach browser_role in array array\['anon', 'authenticated'\] loop/i,
  );
  assert.match(
    migrationSql,
    /if exists \(\s*select 1\s*from pg_roles\s*where rolname = browser_role\s*\) then/i,
  );
  assert.match(
    migrationSql,
    /execute format\(\s*'revoke all privileges on table public\.%I from %I'/i,
  );
  assert.doesNotMatch(
    migrationSql,
    /^revoke\s+.+\s+from\s+(anon|authenticated)\b/gim,
    '缺少角色守卫的直接 REVOKE 会让普通 PostgreSQL CI 失败',
  );
});

test('expand migration 不删除旧表、旧列或旧数据', () => {
  const destructivePatterns = [
    /\bdrop\s+table\b/i,
    /\bdrop\s+column\b/i,
    /\btruncate\b/i,
    /\bdelete\s+from\b/i,
  ];
  for (const pattern of destructivePatterns) {
    assert.doesNotMatch(migrationSql, pattern);
  }

  assert.doesNotMatch(
    migrationSql,
    /\bruntime_state\b[\s\S]*?\bjsonb_(array_elements|to_record|populate_record)\b/i,
  );
  assert.doesNotMatch(migrationSql, /\bjsonb_path_query\b/i);
  assert.match(migrationSql, /^\s*begin;\s*$/im);
  assert.match(migrationSql, /^\s*commit;\s*$/im);
});
