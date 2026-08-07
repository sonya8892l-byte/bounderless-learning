import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { VOICE_KEYS, assertVoiceHasNoSpoiler, renderVoice, resolveVoice } from '../server/course/voice.js';
import { parsePlatformDefaultDocument } from '../src/engine/platform-defaults.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

// 期望值是从搬运前的 service.js 里逐条抄下来的。这张表是 M2-4「只搬文案不改字」的凭据：
// 任何一条对不上，说明搬运过程中改了学生看到的话。
const ORIGINAL = Object.freeze([
  ['role_assigned.欢迎', { roleName: '数龙官', companionName: '絮絮', next: '你到三台了吗？' },
    '欢迎你，数龙官！我是絮絮。你到三台了吗？'],
  ['quick_reply_stale.有下一问', { next: '你到三台了吗？' },
    '刚才的选项已经失效了。你到三台了吗？'],
  ['quick_reply_stale.无下一问', {},
    '刚才的选项已经失效了，我们按当前进度继续。'],
  ['onboarding_not_arrived.无需前往', { next: '准备好了吗？' },
    '这个任务没有指定地点。准备好了吗？'],
  ['onboarding_not_arrived.导航', { location: '三大殿三台' },
    '好，先跟紧小组和老师。我把前往“三大殿三台”的高德地图打开，到了再告诉我。'],
  ['onboarding_not_ready.等待', {},
    '好，我等你。先检查队伍、物品和周围安全，准备好时告诉我。'],
  ['pending_answer.未到达导航', { location: '三大殿三台' },
    '知道了。我把去“三大殿三台”的高德地图打开，你跟着老师和小组移动。'],
  ['pending_answer.等待准备', {},
    '好，我等你。准备好时告诉我就行。'],
  ['pending_answer.到达确认', { next: '准备好了吗？' },
    '到达确认了。准备好了吗？'],
  ['navigation_completed.已到位', { next: '准备好了吗？' },
    '已经到位了。准备好了吗？'],
  ['navigation_completed.继续小步', { stepNumber: 2, stepText: '拍摄侧面' },
    '到位验证通过。现在做第2小步：拍摄侧面。'],
  ['navigation_completed.小步已完成', {},
    '到位验证通过，这个阶段的小步已经完成，可以整理结果提交。'],
  ['navigation_completed.回到任务', { taskName: '观其形' },
    '已经回到“观其形”，我们接着当前小步继续。'],
  ['navigation.无需前往', { taskName: '观其形' },
    '当前“观其形”不需要前往指定地点，可以直接继续。'],
  ['navigation.已打开', { location: '三大殿三台' },
    '我把前往“三大殿三台”的高德地图打开了。请跟随老师统一移动，现场路线变化以老师引导为准。'],
]);

test('voice.md 逐 key 渲染的结果与搬运前的硬编码逐字相同', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const { voice } = course.platformDefaults;

  for (const [key, params, expected] of ORIGINAL) {
    assert.equal(renderVoice(voice, key, params), expected, key);
  }
  assert.deepEqual(Object.keys(voice).sort(), [...VOICE_KEYS].sort(), '模板键集合与代码回落表一致');
});

test('占位符缺值时保留字面量，不静默变成空串', () => {
  const { voice } = resolveVoice(null, {});
  assert.equal(
    renderVoice(voice, 'navigation.已打开', {}),
    '我把前往“{location}”的高德地图打开了。请跟随老师统一移动，现场路线变化以老师引导为准。',
  );
  assert.equal(
    renderVoice(voice, 'navigation.已打开', { location: '' }),
    '我把前往“{location}”的高德地图打开了。请跟随老师统一移动，现场路线变化以老师引导为准。',
  );
  assert.equal(renderVoice(voice, 'navigation_completed.继续小步', { stepNumber: 0, stepText: '看水面' }),
    '到位验证通过。现在做第0小步：看水面。', '0 是有效值，不能当缺值处理');
});

test('课程用 ## 话术覆盖 换掉单条模板，其余保持平台文案', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'voice-override-'));
  t.after(async () => {
    clearCourseCache();
    await fs.rm(root, { recursive: true, force: true });
  });
  await fs.cp(path.join(lessonsRoot, '_platform'), path.join(root, '_platform'), { recursive: true });
  const sourceCourse = path.join(lessonsRoot, 'lesson_gewu_001');
  await fs.cp(sourceCourse, path.join(root, 'lesson_gewu_001'), {
    recursive: true,
    filter: (source) => !path.relative(sourceCourse, source).split(path.sep).includes('assets'),
  });
  await fs.appendFile(
    path.join(root, 'lesson_gewu_001', 'course.md'),
    '\n## 话术覆盖\n\n- navigation.已打开：地图开好了，跟着老师走去“{location}”。\n- 不存在的键：随便写\n',
    'utf8',
  );

  clearCourseCache();
  const course = await compileCourse({ lessonsRoot: root, courseId: 'lesson_gewu_001' });
  const { voice } = course.platformDefaults;

  assert.equal(renderVoice(voice, 'navigation.已打开', { location: '三台' }), '地图开好了，跟着老师走去“三台”。');
  assert.equal(renderVoice(voice, 'pending_answer.等待准备'), '好，我等你。准备好时告诉我就行。');
  assert.equal(
    course.platformDefaults.warnings.filter((item) => item.key === '不存在的键').length,
    1,
    '未知模板键不静默丢弃',
  );
});

test('voice.md 缺失时回落到代码里的话术，行为不变', () => {
  const { voice, warnings } = resolveVoice(null, {});
  assert.deepEqual(warnings, []);
  assert.equal(renderVoice(voice, 'onboarding_not_ready.等待'), '好，我等你。先检查队伍、物品和周围安全，准备好时告诉我。');
});

test('模板命中课程保护词时编译期就报错，不等到学生面前才发现', () => {
  const document = parsePlatformDefaultDocument(
    '> overridable: true\n> merge: by-key\n\n- navigation.已打开：地图开好了，答案是1142条螭首。\n',
    'voice.md',
  );
  const { voice } = resolveVoice(document, {});

  assert.throws(
    () => assertVoiceHasNoSpoiler(voice, ['1142']),
    /话术模板 navigation\.已打开 命中课程保护词「1142」/,
  );
  assert.doesNotThrow(() => assertVoiceHasNoSpoiler(voice, ['螭吻', '']));
});
