import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveStudentRuntime } from '../src/services/runtime-mode.js';

test('未提供 mode 时默认连接 AI，并自动开放角色用于独立体验', () => {
  assert.deepEqual(resolveStudentRuntime('lesson=lesson_gewu_001'), {
    mode: 'connected',
    standalone: false,
    teacherReleasedRoles: true,
  });
});

test('显式 connected 模式继续服从教师开放状态', () => {
  assert.deepEqual(resolveStudentRuntime('mode=connected'), {
    mode: 'connected',
    standalone: false,
    teacherReleasedRoles: false,
  });
  assert.equal(
    resolveStudentRuntime('mode=connected&teacherStart=1').teacherReleasedRoles,
    true,
  );
});

test('只有显式 standalone 才使用本地课程包模式', () => {
  assert.deepEqual(resolveStudentRuntime('mode=standalone'), {
    mode: 'standalone',
    standalone: true,
    teacherReleasedRoles: true,
  });
});
