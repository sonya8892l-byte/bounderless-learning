import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canSwitchLearningView,
  challengeSubmissionPassed,
  challengeTaskAccess,
  clampChallengePageIndex,
  initialLearningView,
  nextLearningView,
} from '../src/engine/learning-view.js';
import { recordClientContext } from '../server/agent/session-state.js';

test('学习视图缺省保持对话，只有课程 Gate 开启时才采用配置默认值', () => {
  assert.equal(initialLearningView(), 'dialogue');
  assert.equal(initialLearningView({ enabled: false, default: 'challenge' }), 'dialogue');
  assert.equal(initialLearningView({ enabled: true, default: 'challenge' }), 'challenge');
});

test('学生只能在课程允许时切换到有效学习视图', () => {
  const enabled = { enabled: true, default: 'dialogue', allowStudentSwitch: true };
  assert.equal(canSwitchLearningView(enabled, 'challenge'), true);
  assert.equal(canSwitchLearningView({ ...enabled, allowStudentSwitch: false }, 'challenge'), false);
  assert.equal(canSwitchLearningView(enabled, 'unknown'), false);
  assert.equal(nextLearningView({ current: 'dialogue', target: 'challenge', config: enabled }), 'challenge');
  assert.equal(nextLearningView({ current: 'dialogue', target: 'challenge', config: { ...enabled, allowStudentSwitch: false } }), 'dialogue');
});

test('闯关反馈只在服务端真实推进 Step 或任务后判定通过', () => {
  const step = {
    kind: 'step', taskIndex: 0, beforeStepIndex: 1, currentTaskIndex: 0,
    runtimeTaskId: 'task-1', taskId: 'task-1', roleCompleted: false,
  };
  assert.equal(challengeSubmissionPassed({ ...step, runtimeStepIndex: 2 }), true);
  assert.equal(challengeSubmissionPassed({ ...step, runtimeStepIndex: 1 }), false);
  assert.equal(challengeSubmissionPassed({
    kind: 'task', taskIndex: 0, beforeStepIndex: 3, currentTaskIndex: 1,
    runtimeTaskId: 'task-2', runtimeStepIndex: 0, taskId: 'task-1', roleCompleted: false,
  }), true);
});

test('服务端只把学习视图记录为环境信息', () => {
  const session = {};
  recordClientContext(session, { learningView: 'challenge' }, 1_700_000_000_000);
  assert.equal(session.environmentState.learningView, 'challenge');
  recordClientContext(session, { learningView: 'invalid' }, 1_700_000_001_000);
  assert.equal(session.environmentState.learningView, 'challenge');
});

test('闯关分页只开放已完成任务和当前任务', () => {
  const context = { progress: 1, taskCount: 3, roleCompleted: false };
  assert.equal(challengeTaskAccess({ ...context, taskIndex: 0 }), 'completed');
  assert.equal(challengeTaskAccess({ ...context, taskIndex: 1 }), 'current');
  assert.equal(challengeTaskAccess({ ...context, taskIndex: 2 }), 'locked');
  assert.equal(clampChallengePageIndex({ ...context, requestedIndex: 2 }), 1);
  assert.equal(clampChallengePageIndex({ ...context, requestedIndex: 0 }), 0);
  assert.equal(clampChallengePageIndex({ ...context, requestedIndex: 2, allowAll: true }), 2);
});
