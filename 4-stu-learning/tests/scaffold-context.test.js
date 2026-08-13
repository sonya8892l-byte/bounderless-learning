import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activateScaffoldContext,
  scaffoldContextKey,
  scaffoldLevelFor,
  setScaffoldContextLevel,
  setScaffoldStepOverride,
} from '../server/agent/scaffold-context.js';

function session(scaffoldLevel = 0) {
  return { scaffoldLevel, learnerState: { scaffoldLevel } };
}

test('脚手架按任务、小步和求助类型隔离，切换上下文不会继承旧档位', () => {
  const state = session();
  const stuck = { taskId: 'task-1', stepId: 'step-1', helpType: 'help_stuck' };
  const start = { taskId: 'task-1', stepId: 'step-1', helpType: 'help_start' };
  const nextStep = { taskId: 'task-1', stepId: 'step-2', helpType: 'help_stuck' };
  const nextTask = { taskId: 'task-2', stepId: 'step-1', helpType: 'help_stuck' };

  setScaffoldContextLevel(state, stuck, 3);
  assert.equal(scaffoldLevelFor(state, stuck), 3);
  assert.equal(scaffoldLevelFor(state, start), 0);
  assert.equal(scaffoldLevelFor(state, nextStep), 0);
  assert.equal(scaffoldLevelFor(state, nextTask), 0);

  activateScaffoldContext(state, nextStep);
  assert.equal(state.scaffoldLevel, 0);
  assert.equal(state.learnerState.scaffoldLevel, 0);
  assert.notEqual(scaffoldContextKey(stuck), scaffoldContextKey(nextStep));
});

test('教师覆盖只作用于当前任务小步，并统一覆盖该步不同求助类型', () => {
  const state = session();
  const current = { taskId: 'task-1', stepId: 'step-1', helpType: 'task_help' };
  const otherType = { ...current, helpType: 'request_answer' };
  const nextStep = { taskId: 'task-1', stepId: 'step-2', helpType: 'task_help' };

  setScaffoldStepOverride(state, current, 2);
  assert.equal(scaffoldLevelFor(state, current), 2);
  assert.equal(scaffoldLevelFor(state, otherType), 2);
  assert.equal(scaffoldLevelFor(state, nextStep), 0);

  setScaffoldStepOverride(state, current, 1);
  assert.equal(scaffoldLevelFor(state, otherType), 1, '教师可手动降低当前步档位');
});

test('旧会话只在首次激活当前上下文时迁移全局档位', () => {
  const state = session(3);
  const legacy = { taskId: 'task-1', stepId: 'step-1', helpType: 'task_help' };
  const newTask = { taskId: 'task-2', stepId: 'step-1', helpType: 'task_help' };

  activateScaffoldContext(state, legacy, { migrateLegacy: true });
  assert.equal(scaffoldLevelFor(state, legacy), 3);
  activateScaffoldContext(state, newTask, { migrateLegacy: true });
  assert.equal(state.scaffoldLevel, 0, '已有上下文后切任务不再迁移旧全局值');
});
