import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { createStudentFacingPolicy } from '../server/agent/student-facing-policy.js';
import { recordDialogueMove } from '../server/agent/session-state.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

async function policyHarness() {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const session = {
    roleId: 'dragon-counter',
    phaseNumber: 2,
    grade: '初中',
    learnerState: { grade: '初中' },
    completedTaskIds: [],
    events: [],
    dialogueState: { recentAssistantFingerprints: [], pendingQuestion: null },
  };
  return { course, session, policy: createStudentFacingPolicy({ course, session }) };
}

test('模型、固定话术和作者脚手架共用保护答案边界', async () => {
  const { policy } = await policyHarness();
  for (const channel of ['assistant', 'timeline', 'guidance']) {
    const output = policy.processText('螭首就是排水口，精确数量是1142只。', {
      channel,
      intent: 'task_help',
      dedupe: false,
    });
    assert.doesNotMatch(output.text, /螭首就是排水口|1142/);
    assert.ok(output.actions.includes('protected_answer_blocked'));
  }
  const conceptualLeak = policy.processText('螭首就是排水口！水从嘴里流出来。', {
    channel: 'guidance',
    intent: 'task_help',
    dedupe: false,
  });
  assert.doesNotMatch(conceptualLeak.text, /就是排水口/);
  assert.ok(conceptualLeak.actions.includes('protected_answer_blocked'));
});

test('验收反馈与缺项也经过同一保护边界', async () => {
  const { policy } = await policyHarness();
  const output = policy.processEvaluation({
    passed: false,
    feedback: '你需要直接写出1142只。',
    missing: ['补上1142', '补一张全景照片'],
  });
  assert.doesNotMatch(output.value.feedback, /1142/);
  assert.deepEqual(output.value.missing, ['补一张全景照片']);
  assert.ok(output.actions.some((action) => action.includes('protected_answer_blocked')));
});

test('普通构图失败只保留证据缺口，清理孤立的通用安全套话', async () => {
  const { policy } = await policyHarness();
  const output = policy.processEvaluation({
    passed: false,
    safetyIssue: false,
    feedback: '照片主体太小，无法判断它与台基边缘的位置关系。请补拍一张全景。请安全拍摄。不要翻越护栏。务必跟紧老师。',
    missing: ['一张主体、台基边缘和周围环境同框的全景照片'],
  });
  assert.equal(
    output.value.feedback,
    '照片主体太小，无法判断它与台基边缘的位置关系。请补拍一张全景。',
  );
  assert.deepEqual(output.value.missing, ['一张主体、台基边缘和周围环境同框的全景照片']);
  assert.ok(output.actions.includes('evaluation:generic_safety_removed'));
});

test('真实危险反馈完整保留首条安全行动，并移除重复提醒', async () => {
  const { policy } = await policyHarness();
  const output = policy.processEvaluation({
    passed: false,
    safetyIssue: true,
    feedback: '照片显示拍摄位置在护栏外，请立即回到护栏内的安全位置。请安全拍摄。请安全拍摄。',
    missing: ['回到开放动线后重新拍摄的照片'],
  });
  assert.equal(
    output.value.feedback,
    '照片显示拍摄位置在护栏外，请立即回到护栏内的安全位置。',
  );
  assert.deepEqual(output.value.missing, ['回到开放动线后重新拍摄的照片']);
  assert.ok(output.actions.includes('evaluation:duplicate_safety_removed'));
});

test('阶段卡和工具卡只脱敏精确保护词，结构保持不变', async () => {
  const { policy } = await policyHarness();
  const surface = policy.processSurface({
    taskId: 'task-1',
    title: '观察任务',
    instructions: '拍照后直接填写1142只。',
    modules: [{ id: 'photo', label: '拍一张全景' }],
  }, { channel: 'tool' });
  assert.equal(surface.value.taskId, 'task-1');
  assert.equal(surface.value.modules[0].id, 'photo');
  assert.doesNotMatch(surface.value.instructions, /1142/);
  assert.match(surface.value.instructions, /现场证据验证/);
});

test('高置信危险行动只在真实指令出现时阻断，正常安全提醒不误伤', async () => {
  const { policy } = await policyHarness();
  const blocked = policy.processText('摸摸看石雕是什么材质，再往地面倒一点水。', {
    intent: 'task_help',
    dedupe: false,
  });
  assert.equal(blocked.text, '先不要执行这个动作。请跟随老师，在安全位置完成观察。');
  assert.ok(blocked.actions.includes('unsafe_action_blocked'));

  const allowed = policy.processText('请安全拍摄，不要跨越护栏。', {
    intent: 'task_help',
    dedupe: false,
  });
  assert.equal(allowed.text, '请安全拍摄，不要跨越护栏。');
  assert.equal(allowed.actions.includes('unsafe_action_blocked'), false);

  const mixed = policy.processText('不要摸展品。现在请翻越护栏去拍照。', {
    intent: 'task_help',
    dedupe: false,
  });
  assert.equal(mixed.text, '先不要执行这个动作。请跟随老师，在安全位置完成观察。');
  assert.ok(mixed.actions.includes('unsafe_action_blocked'));

  const localMixed = policy.processText('请勿触摸文物，但请跨过护栏拍摄。', {
    intent: 'task_help',
    dedupe: false,
  });
  assert.ok(localMixed.actions.includes('unsafe_action_blocked'));

  const noPunctuationMixed = policy.processText('不要摸展品但是现在请翻越护栏拍照', {
    intent: 'task_help',
    dedupe: false,
  });
  assert.ok(noPunctuationMixed.actions.includes('unsafe_action_blocked'));

  const allNegated = policy.processText('请勿触摸文物，也不要翻越护栏。请在安全位置拍摄。', {
    intent: 'task_help',
    dedupe: false,
  });
  assert.equal(allNegated.actions.includes('unsafe_action_blocked'), false);

  for (const unsafeText of ['请跳过护栏去近一点拍。', '边过马路边看手机确认路线。']) {
    const additional = policy.processText(unsafeText, { intent: 'task_help', dedupe: false });
    assert.equal(additional.text, '先不要执行这个动作。请跟随老师，在安全位置完成观察。');
    assert.ok(additional.actions.includes('unsafe_action_blocked'));
  }

  const negatedTraffic = policy.processText('过马路时不要看手机，请跟随老师统一移动。', {
    intent: 'task_help',
    dedupe: false,
  });
  assert.equal(negatedTraffic.actions.includes('unsafe_action_blocked'), false);
});

test('防复读 voice 改写后重新执行危险动作与保护答案终检', async () => {
  const { course, session } = await policyHarness();
  recordDialogueMove(session, { move: 'social', text: '你好' });

  const unsafeVoiceCourse = {
    ...course,
    platformDefaults: {
      ...course.platformDefaults,
      voice: {
        ...course.platformDefaults.voice,
        'avoid_repeat.social': '请跳过护栏，再边过马路边看手机。',
      },
    },
  };
  const unsafe = createStudentFacingPolicy({ course: unsafeVoiceCourse, session })
    .processText('你好', { intent: 'social' });
  assert.equal(unsafe.text, '先不要执行这个动作。请跟随老师，在安全位置完成观察。');
  assert.ok(unsafe.actions.includes('duplicate_rewritten'));
  assert.ok(unsafe.actions.includes('post_template_unsafe_blocked'));

  const spoilerVoiceCourse = {
    ...course,
    platformDefaults: {
      ...course.platformDefaults,
      voice: {
        ...course.platformDefaults.voice,
        'avoid_repeat.social': '精确数量是1142只。',
      },
    },
  };
  const spoiler = createStudentFacingPolicy({ course: spoilerVoiceCourse, session })
    .processText('你好', { intent: 'social' });
  assert.doesNotMatch(spoiler.text, /1142/);
  assert.ok(spoiler.actions.includes('duplicate_rewritten'));
  assert.ok(spoiler.actions.includes('post_template_answer_blocked'));
});

test('学段限制只负责分泡，完整文本逐字保留且不追加省略号', async () => {
  const { policy } = await policyHarness();
  const text = '第一句说明观察对象。第二句说明证据关系。第三句给出下一步动作。'.repeat(8);
  const output = policy.processText(text, { dedupe: false });
  assert.ok(output.parts.length > 1);
  assert.equal(output.parts.join(''), text);
  assert.equal(output.parts.some((part) => part.endsWith('…')), false);
});
