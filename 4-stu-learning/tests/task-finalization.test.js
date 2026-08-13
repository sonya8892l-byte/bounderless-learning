import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLesson } from '../src/engine/lesson-parser.js';
import {
  DEFAULT_TASK_FINALIZATION_MODE,
  createTaskFinalizationState,
  deriveTaskFinalizationStatus,
  reduceTaskFinalization,
} from '../src/engine/task-finalization.js';

function task(mode = DEFAULT_TASK_FINALIZATION_MODE) {
  return {
    id: `task-${mode}`,
    finalizationMode: mode,
    steps: [{ id: 'step-1' }, { id: 'step-2' }],
  };
}

function pass(state, taskValue, stepId) {
  return reduceTaskFinalization(state, { type: 'step_passed', stepId }, taskValue);
}

test('三种收口方式在末步成功后进入各自唯一状态', () => {
  const expected = new Map([
    ['auto_on_last_step', 'completed'],
    ['explicit_bundle_submit', 'awaiting_bundle_submit'],
    ['teacher_confirm', 'awaiting_teacher_confirm'],
  ]);

  for (const [mode, finalStatus] of expected) {
    const taskValue = task(mode);
    const initial = createTaskFinalizationState(taskValue);
    const first = pass(initial, taskValue, 'step-1');
    const last = pass(first.state, taskValue, 'step-2');

    assert.equal(initial.status, 'collecting_steps');
    assert.equal(first.state.status, 'collecting_steps');
    assert.equal(last.state.status, finalStatus, mode);
    assert.deepEqual(last.state.completedStepIds, ['step-1', 'step-2']);
  }
});

test('末步失败绝不完成；同一步通过后才按模式进入收口', () => {
  for (const mode of ['auto_on_last_step', 'explicit_bundle_submit', 'teacher_confirm']) {
    const taskValue = task(mode);
    const first = pass(createTaskFinalizationState(taskValue), taskValue, 'step-1').state;
    const failed = reduceTaskFinalization(first, {
      type: 'step_failed',
      stepId: 'step-2',
      reason: '缺少判断依据',
    }, taskValue);

    assert.equal(failed.state.status, 'revision_required');
    assert.equal(failed.state.completedStepIds.includes('step-2'), false);
    assert.equal(failed.state.revision.reason, '缺少判断依据');

    const retried = pass(failed.state, taskValue, 'step-2');
    assert.equal(retried.state.status, mode === 'auto_on_last_step'
      ? 'completed'
      : mode === 'teacher_confirm'
        ? 'awaiting_teacher_confirm'
        : 'awaiting_bundle_submit');
  }
});

test('整包提交只完成 explicit 模式，教师确认只完成 teacher 模式', () => {
  const autoTask = task('auto_on_last_step');
  const auto = createTaskFinalizationState(autoTask, { completedStepIds: ['step-1', 'step-2'] });
  const autoRejectsBundle = reduceTaskFinalization(auto, { type: 'bundle_submitted' }, autoTask);
  assert.equal(autoRejectsBundle.changed, false);
  assert.equal(autoRejectsBundle.reason, 'mode_rejects_bundle_submission');

  const explicitTask = task('explicit_bundle_submit');
  let explicit = createTaskFinalizationState(explicitTask, { completedStepIds: ['step-1', 'step-2'] });
  const wrongTeacher = reduceTaskFinalization(explicit, { type: 'teacher_confirmed' }, explicitTask);
  assert.equal(wrongTeacher.changed, false);
  assert.equal(wrongTeacher.reason, 'mode_rejects_teacher_confirmation');
  assert.strictEqual(wrongTeacher.state, explicit);

  const bundle = reduceTaskFinalization(explicit, { type: 'bundle_submitted' }, explicitTask);
  assert.equal(bundle.changed, true);
  assert.equal(bundle.state.status, 'completed');

  const teacherTask = task('teacher_confirm');
  let teacher = createTaskFinalizationState(teacherTask, { completedStepIds: ['step-1', 'step-2'] });
  const wrongBundle = reduceTaskFinalization(teacher, { type: 'bundle_submitted' }, teacherTask);
  assert.equal(wrongBundle.changed, false);
  assert.equal(wrongBundle.reason, 'mode_rejects_bundle_submission');
  assert.strictEqual(wrongBundle.state, teacher);

  const confirmed = reduceTaskFinalization(teacher, { type: 'teacher_confirmed' }, teacherTask);
  assert.equal(confirmed.changed, true);
  assert.equal(confirmed.state.status, 'completed');
});

test('收口归约幂等，过早和重复事件保留原状态并返回原因', () => {
  const taskValue = task('explicit_bundle_submit');
  const initial = createTaskFinalizationState(taskValue);
  const earlyBundle = reduceTaskFinalization(initial, { type: 'bundle_submitted' }, taskValue);
  assert.deepEqual(earlyBundle, { state: initial, changed: false, reason: 'steps_pending' });

  const first = pass(initial, taskValue, 'step-1');
  const duplicateStep = pass(first.state, taskValue, 'step-1');
  assert.equal(duplicateStep.changed, false);
  assert.equal(duplicateStep.reason, 'step_already_completed');
  assert.strictEqual(duplicateStep.state, first.state);

  const waiting = pass(first.state, taskValue, 'step-2').state;
  const completed = reduceTaskFinalization(waiting, { type: 'bundle_submitted' }, taskValue);
  const duplicateBundle = reduceTaskFinalization(completed.state, { type: 'bundle_submitted' }, taskValue);
  assert.equal(duplicateBundle.changed, false);
  assert.equal(duplicateBundle.reason, 'already_completed');
  assert.strictEqual(duplicateBundle.state, completed.state);
});

test('拒绝后进入 revision_required，后续合法确认可完成', () => {
  const explicitTask = task('explicit_bundle_submit');
  const explicit = createTaskFinalizationState(explicitTask, { completedStepIds: ['step-1', 'step-2'] });
  const rejectedBundle = reduceTaskFinalization(explicit, {
    type: 'bundle_rejected', reason: '全景证据不足',
  }, explicitTask);
  assert.equal(rejectedBundle.state.status, 'revision_required');
  assert.equal(rejectedBundle.state.revision.reason, '全景证据不足');
  assert.equal(
    reduceTaskFinalization(rejectedBundle.state, { type: 'bundle_submitted' }, explicitTask).state.status,
    'completed',
  );

  const teacherTask = task('teacher_confirm');
  const teacher = createTaskFinalizationState(teacherTask, { completedStepIds: ['step-1', 'step-2'] });
  const rejectedByTeacher = reduceTaskFinalization(teacher, {
    type: 'teacher_rejected', reason: '请补充口头说明',
  }, teacherTask);
  assert.equal(rejectedByTeacher.state.status, 'revision_required');
  assert.equal(
    reduceTaskFinalization(rejectedByTeacher.state, { type: 'teacher_confirmed' }, teacherTask).state.status,
    'completed',
  );
});

test('可从旧会话的小步完成事实重建状态，忽略其他任务的小步 ID', () => {
  const taskValue = task('teacher_confirm');
  assert.equal(deriveTaskFinalizationStatus(taskValue, {
    completedStepIds: ['other-task-step', 'step-1', 'step-2'],
  }), 'awaiting_teacher_confirm');
  assert.deepEqual(createTaskFinalizationState(taskValue, {
    completedStepIds: ['other-task-step', 'step-1', 'step-1'],
  }).completedStepIds, ['step-1']);
  assert.equal(createTaskFinalizationState(taskValue, { completed: true }).status, 'completed');
});

test('解析任务级收口方式：缺省自动、三值生效、未知值告警回落', () => {
  const warnings = [];
  const lesson = parseLesson({
    id: 'finalization-parser-test',
    assetBase: 'assets',
    files: {
      'course.md': [
        '# 收口测试课',
        '## 基本信息',
        '- 主题模板：test',
        '## 学生端角色体系',
        '- collectionName：测试集合',
        '- itemName：角色',
        '- collectionItemName：线索',
        '- collectionPanelName：面板',
        '- unlockTarget：终章',
        '- 任务阶段：phase-2',
      ].join('\n'),
      'phases.md': [
        '## Phase 1：入场',
        '### 阶段任务1：教师确认任务',
        '- 收口方式：teacher_confirm',
        '- 通过条件：完成',
        '## Phase 2：现场',
      ].join('\n'),
      'roles/tester.md': [
        '# 测试角色',
        '## 基本信息',
        '- 选择说明：测试用',
        '- 收集物：线索',
        '- 收集物图：tokens/a.png',
        '- 角色卡图：cards/a.png',
        '- 角色徽章图：badges/a.png',
        '## 任务列表',
        '### 任务1：旧任务',
        '- 通过条件：完成',
        '### 任务2：末步自动收口',
        '- 收口方式：AUTO_ON_LAST_STEP',
        '- 通过条件：完成',
        '### 任务3：错值',
        '- 收口方式：submit_sometime',
        '- 通过条件：完成',
      ].join('\n'),
    },
  }, { onWarning: (warning) => warnings.push(warning) });

  assert.equal(lesson.phases[0].tasks[0].finalizationMode, 'teacher_confirm');
  assert.deepEqual(
    lesson.roles[0].tasks.map((item) => item.finalizationMode),
    ['auto_on_last_step', 'auto_on_last_step', 'auto_on_last_step'],
  );
  const bad = warnings.filter((warning) => warning.code === 'bad_task_finalization_mode');
  assert.equal(bad.length, 1);
  assert.equal(bad[0].taskId, 'task-3');
  assert.equal(bad[0].field, '收口方式');
  assert.equal(bad[0].value, 'submit_sometime');
  assert.match(bad[0].message, /auto_on_last_step/);
});
