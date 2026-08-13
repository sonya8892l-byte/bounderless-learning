import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveStudentRuntime } from '../src/services/runtime-mode.js';

test('本地联调未提供 mode 时默认连接 Agent/AI', () => {
  assert.deepEqual(resolveStudentRuntime('lesson=lesson_gewu_001'), {
    mode: 'connected',
    standalone: false,
    standaloneDenied: false,
    teacherReleasedRoles: true,
  });
});

test('公开托管页面无正式场次时可显式默认为课程包体验', () => {
  assert.deepEqual(resolveStudentRuntime('lesson=lesson_gewu_001', { defaultStandalone: true }), {
    mode: 'standalone',
    standalone: true,
    standaloneDenied: false,
    teacherReleasedRoles: true,
  });
});

test('教师发放的场次身份默认进入正式连接流程', () => {
  assert.deepEqual(resolveStudentRuntime('runId=run-1&participantId=student-1'), {
    mode: 'connected',
    standalone: false,
    standaloneDenied: false,
    teacherReleasedRoles: false,
  });
});

test('显式 connected 模式继续服从教师开放状态', () => {
  assert.deepEqual(resolveStudentRuntime('mode=connected'), {
    mode: 'connected',
    standalone: false,
    standaloneDenied: false,
    teacherReleasedRoles: false,
  });
  assert.equal(
    resolveStudentRuntime('mode=connected&teacherStart=1').teacherReleasedRoles,
    true,
  );
});

test('显式 standalone 使用本地课程包模式', () => {
  assert.deepEqual(resolveStudentRuntime('mode=standalone'), {
    mode: 'standalone',
    standalone: true,
    standaloneDenied: false,
    teacherReleasedRoles: true,
  });
});

test('发布环境未显式开放预览时，URL 不能自行切到 standalone', () => {
  assert.deepEqual(resolveStudentRuntime('mode=standalone', { allowStandalone: false }), {
    mode: 'connected',
    standalone: false,
    standaloneDenied: true,
    teacherReleasedRoles: false,
  });
});
