import assert from 'node:assert/strict';
import test from 'node:test';
import {
  completeLocalTaskProgress,
  resolveLocalPendingAdvance,
  studentCanCompleteStep,
} from '../src/engine/local-task-progress.js';
import { qaForceCompleteEnabled } from '../src/engine/qa-mode.js';
import { qaForceCompleteEnabled as serverQaForceCompleteEnabled } from '../server/config/env.js';

test('前端验收 Gate 仅由显式变量开启，普通本地开发页不显示', () => {
  assert.equal(qaForceCompleteEnabled({}), false);
  assert.equal(qaForceCompleteEnabled({ DEV: true }), false);
  assert.equal(qaForceCompleteEnabled({ VITE_QA_FORCE_COMPLETE_ENABLED: 'true' }), true);
  assert.equal(qaForceCompleteEnabled({ VITE_QA_FORCE_COMPLETE_ENABLED: 'false' }), false);
});

test('服务端验收 Gate 在 Production 永久关闭，其他环境需要显式授权', () => {
  assert.equal(serverQaForceCompleteEnabled({ APP_ENV: 'production', QA_FORCE_COMPLETE_ENABLED: true }), false);
  assert.equal(serverQaForceCompleteEnabled({
    VERCEL_ENV: 'production',
    APP_ENV: 'local',
    QA_FORCE_COMPLETE_ENABLED: true,
  }), false);
  assert.equal(serverQaForceCompleteEnabled({ APP_ENV: 'local', QA_FORCE_COMPLETE_ENABLED: false }), false);
  assert.equal(serverQaForceCompleteEnabled({ APP_ENV: 'local', QA_FORCE_COMPLETE_ENABLED: true }), true);
  assert.equal(serverQaForceCompleteEnabled({ APP_ENV: 'preview', QA_FORCE_COMPLETE_ENABLED: false }), false);
  assert.equal(serverQaForceCompleteEnabled({ APP_ENV: 'preview', QA_FORCE_COMPLETE_ENABLED: true }), true);
  assert.equal(serverQaForceCompleteEnabled({
    VERCEL_ENV: 'preview',
    APP_ENV: 'local',
    QA_FORCE_COMPLETE_ENABLED: false,
  }), false);
});

test('standalone 验收真实完成当前任务并推进，且留下独立记录', () => {
  const role = {
    id: 'observer',
    tasks: [
      { id: 'task-1', steps: [{ id: 's1' }, { id: 's2' }] },
      { id: 'task-2', guidanceSteps: ['a', 'b', 'c'] },
    ],
  };
  const roleState = {
    progress: 0,
    completed: false,
    guidanceStepIndices: {},
    messages: [{ type: 'task', status: 'active', payload: { taskId: 'task-1' } }],
    challengePageIndex: 0,
    pendingAdvance: { taskId: 'task-1', mode: 'teacher' },
  };
  const first = completeLocalTaskProgress({
    role,
    roleState,
    taskId: 'task-1',
    qaOverride: true,
    now: Date.UTC(2026, 7, 11),
  });
  assert.equal(first.ok, true);
  assert.equal(roleState.guidanceStepIndices['task-1'], 2);
  assert.equal(roleState.progress, 1);
  assert.equal(roleState.challengePageIndex, 1);
  assert.equal(roleState.completed, false);
  assert.equal(roleState.pendingAdvance, null);
  assert.equal(roleState.messages[0].status, 'complete');
  assert.equal(roleState.qaOverrides[0].type, 'qa_override');

  const stale = completeLocalTaskProgress({ role, roleState, taskId: 'task-1', qaOverride: true });
  assert.equal(stale.code, 'TASK_EXPIRED');
  const last = completeLocalTaskProgress({ role, roleState, taskId: 'task-2', qaOverride: true });
  assert.equal(last.roleCompleted, true);
  assert.equal(roleState.progress, 2);
  assert.equal(roleState.challengePageIndex, 1);
});

test('standalone 普通完成尊重学生与教师推进边界', () => {
  const role = {
    id: 'observer',
    tasks: [
      { id: 'student-next', advanceMode: 'ai_suggest', steps: [{ id: 's1' }] },
      { id: 'teacher-next', advanceMode: 'teacher', steps: [{ id: 's2' }] },
      { id: 'auto-next', advanceMode: 'auto_after_validation', steps: [{ id: 's3' }] },
    ],
  };
  const roleState = {
    progress: 0,
    completed: false,
    guidanceStepIndices: {},
    taskFinalizations: {},
    messages: [],
    challengePageIndex: 0,
  };

  const studentWait = completeLocalTaskProgress({ role, roleState, taskId: 'student-next' });
  assert.equal(studentWait.advanced, false);
  assert.equal(roleState.progress, 0);
  assert.deepEqual(roleState.pendingAdvance, {
    taskId: 'student-next', mode: 'student', completedId: 'observer:student-next',
  });
  assert.equal(resolveLocalPendingAdvance({ role, roleState, taskId: 'student-next', actor: 'teacher' }).code, 'ADVANCE_NOT_AUTHORIZED');
  assert.equal(resolveLocalPendingAdvance({ role, roleState, taskId: 'student-next', actor: 'student' }).advanced, true);
  assert.equal(roleState.progress, 1);

  const teacherWait = completeLocalTaskProgress({ role, roleState, taskId: 'teacher-next' });
  assert.equal(teacherWait.waitingMode, 'teacher');
  assert.equal(resolveLocalPendingAdvance({ role, roleState, taskId: 'teacher-next', actor: 'student' }).code, 'ADVANCE_NOT_AUTHORIZED');
  assert.equal(roleState.progress, 1);
  assert.equal(resolveLocalPendingAdvance({ role, roleState, taskId: 'teacher-next', actor: 'teacher' }).advanced, true);

  const automatic = completeLocalTaskProgress({ role, roleState, taskId: 'auto-next' });
  assert.equal(automatic.advanced, true);
  assert.equal(automatic.roleCompleted, true);
});

test('学生端不能代替教师确认或伪造到达事件', () => {
  assert.equal(studentCanCompleteStep({ completionMode: 'teacher_confirm' }), false);
  assert.equal(studentCanCompleteStep({ completionMode: 'location_event' }), false);
  assert.equal(studentCanCompleteStep({ completionMode: 'user_confirm' }), true);
  assert.equal(studentCanCompleteStep({ completionMode: 'ai_evaluation' }), true);
});
