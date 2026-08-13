import assert from 'node:assert/strict';
import test from 'node:test';
import { courseRunGateFromError } from '../src/engine/course-run-gate.js';

const current = {
  status: 'active', paused: false, rallyActive: false,
  rolesReleased: true, rolesLocked: false, sessionInactive: false,
};

test('场次门禁错误立即投影为学生端权威状态', () => {
  assert.equal(courseRunGateFromError({ code: 'COURSE_RUN_PAUSED', message: '暂停' }, current).paused, true);
  assert.equal(courseRunGateFromError({ code: 'COURSE_RUN_RALLY_ACTIVE', message: '集合' }, current).rallyActive, true);
  assert.equal(courseRunGateFromError({ code: 'COURSE_RUN_COMPLETED', message: '结束' }, current).status, 'completed');
  assert.equal(courseRunGateFromError({ code: 'COURSE_RUN_NOT_ACTIVE', message: '等待' }, current).status, 'draft');
  assert.equal(courseRunGateFromError({ code: 'COURSE_SESSION_INACTIVE', message: '失效' }, current).sessionInactive, true);
  const locked = courseRunGateFromError({ code: 'COURSE_ROLES_LOCKED', message: '锁定' }, current);
  assert.equal(locked.rolesReleased, false);
  assert.equal(locked.rolesLocked, true);
});

test('非场次错误不被伪装成教师门禁', () => {
  assert.equal(courseRunGateFromError({ code: 'AGENT_NETWORK_ERROR' }, current), null);
});
