import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateNudge } from '../server/agent/nudge-policy.js';
import { hasActiveEvidenceProcessing, hasCurrentTaskDraft } from '../src/engine/draft-state.js';

function dueFixture() {
  const now = Date.parse('2026-08-11T10:00:00.000Z');
  return {
    now,
    task: {
      timing: { idleNudgeSeconds: 60, nudgeCooldownSeconds: 60 },
      nudgePolicy: { maxNudges: 1 },
      location: { mode: 'none' },
    },
    session: {
      taskState: { lastMeaningfulActionAt: new Date(now - 120_000).toISOString() },
      conversationState: { nudgeCount: 0, studentSignal: 'neutral' },
      dialogueState: { lifecycle: 'GUIDE_CURRENT_STEP' },
      learningState: {},
      locationState: { status: 'not_required' },
    },
  };
}

test('学生空闲且无忙碌活动时按任务阈值提醒', () => {
  const fixture = dueFixture();
  const result = evaluateNudge({
    ...fixture,
    input: {
      type: 'lifecycle_event', event: 'context_tick',
      data: { pageVisible: true, hasDraft: false, busy: {} },
    },
  });
  assert.equal(result.due, true);
});

test('媒体、相机、录音、上传、验收和导航期间全部抑制提醒', () => {
  for (const kind of [
    'mediaPlaying',
    'cameraOrFilePicker',
    'recording',
    'uploadOrProcessing',
    'evaluation',
    'navigation',
  ]) {
    const fixture = dueFixture();
    const result = evaluateNudge({
      ...fixture,
      input: {
        type: 'lifecycle_event', event: 'context_tick',
        data: { pageVisible: true, hasDraft: false, busy: { [kind]: true } },
      },
    });
    assert.equal(result.due, false, kind);
    assert.equal(result.reason, 'student_busy', kind);
    assert.equal(result.busy, kind, kind);
  }
});

test('证据上传计数从上传开始到结束都维持 busy，重叠上传不会提前清空', () => {
  assert.equal(hasActiveEvidenceProcessing({ uploadCount: 1 }), true);
  assert.equal(hasActiveEvidenceProcessing({ uploadCount: 2 }), true);
  assert.equal(hasActiveEvidenceProcessing({ uploadCount: 0 }), false);
  assert.equal(hasActiveEvidenceProcessing({
    uploadCount: 0,
    toolValues: [{ processing: false }, { processing: true }],
  }), true);
});

test('历史任务留有照片不会让新任务永久处于草稿忙碌态', () => {
  const evidenceByTask = {
    'task-old': { text: '已提交的记录', files: [{ name: 'old.jpg' }] },
    'task-current': { text: '', files: [] },
  };
  assert.equal(hasCurrentTaskDraft({ evidenceByTask, taskId: 'task-current' }), false);
  assert.equal(hasCurrentTaskDraft({ evidenceByTask, taskId: 'task-old' }), true);
  assert.equal(hasCurrentTaskDraft({ evidenceByTask, taskId: 'task-current', chatDraft: '正在输入' }), true);
});

test('当前任务工具里已填写文字、选择或媒体也算草稿', () => {
  const evidenceByTask = {
    current: {
      text: '',
      files: [],
      toolValues: {
        step1: { text: { fields: { reason: '已经填好但还没提交' } } },
      },
    },
    empty: {
      text: '',
      files: [],
      toolValues: { step1: { photo: { count: 0, processing: false } } },
    },
  };
  assert.equal(hasCurrentTaskDraft({ evidenceByTask, taskId: 'current' }), true);
  assert.equal(hasCurrentTaskDraft({ evidenceByTask, taskId: 'empty' }), false);
});
