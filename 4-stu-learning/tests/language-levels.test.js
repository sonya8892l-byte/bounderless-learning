import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { languageLevelFor, resolveLanguageLevels } from '../server/course/platform-defaults.js';
import { applyGradeResponsePolicy, splitGradeResponse } from '../server/agent/dialogue-policy.js';
import { buildAgentPrompt } from '../server/agent/prompt.js';
import { parsePlatformDefaultDocument } from '../src/engine/platform-defaults.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

function promptFor(course, grade) {
  const role = course.roles[0];
  return buildAgentPrompt({
    course,
    role,
    session: {
      phaseId: 'phase-2',
      phaseNumber: 2,
      roleId: role.id,
      currentTaskIndex: 0,
      scaffoldLevel: 0,
      grade,
      completedTaskIds: [],
      events: [],
      messages: [],
      taskState: { taskId: role.tasks[0].id, guidanceStepIndex: 0 },
    },
    knowledge: [],
    input: { type: 'user_text', text: '我该怎么记录？' },
    decision: { intent: 'course_question', includeTaskContext: true, includeRestrictions: false, allowedTools: [] },
  }).instructions;
}

// 这四组值是搬进 md 之前 prompt.js 与 dialogue-policy.js 里的原始硬编码。
// 断言逐字相同，保证 M2-2 只换了来源、没换行为。
const ORIGINAL = [
  { grade: '三年级', line: '小学低年级：15–30字为主，短句、具体词和二选一问题。', limit: 48 },
  { grade: '五年级', line: '小学高年级：30–50字为主，一次只给一个行动和一个观察点。', limit: 72 },
  { grade: '初中', line: '初中：50–80字为主，鼓励先尝试，再按需要给提示。', limit: 100 },
  { grade: '高三', line: '高中：80–120字为主，可以使用开放问题并要求说明证据。', limit: 140 },
];

test('language-levels.md 的四档与搬运前的硬编码逐字相同', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const levels = course.platformDefaults.languageLevels;

  for (const item of ORIGINAL) {
    const level = languageLevelFor(levels, item.grade);
    assert.equal(`${level.id}：${level.words}字为主，${level.style}。`, item.line);
    assert.equal(level.limit, item.limit, `${item.grade} 的硬上限`);
  }
});

test('学段匹配顺序不变：低年级优先于小学，未命中按初中', () => {
  const levels = resolveLanguageLevels(null);
  assert.equal(languageLevelFor(levels, '小学三年级').id, '小学低年级');
  assert.equal(languageLevelFor(levels, '小学五年级').id, '小学高年级');
  assert.equal(languageLevelFor(levels, '').id, '初中');
  assert.equal(languageLevelFor(null, '高三').id, '高中');
});

test('初一/初二与高一/高二按真实学段匹配，混合课程范围回落初中', () => {
  const levels = resolveLanguageLevels(null);
  for (const grade of ['初一', '初二']) assert.equal(languageLevelFor(levels, grade).id, '初中', grade);
  for (const grade of ['高一', '高二']) assert.equal(languageLevelFor(levels, grade).id, '高中', grade);
  assert.equal(languageLevelFor(levels, '小学高年级 / 初中 / 高中').id, '初中');
});

test('两个消费点读同一份定义：prompt 管目标字数，硬上限完整分泡且不丢字', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'language-levels-'));
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

  clearCourseCache();
  const before = await compileCourse({ lessonsRoot: root, courseId: 'lesson_gewu_001' });
  assert.match(promptFor(before, '初中'), /初中：50–80字为主/);
  const long = '喔'.repeat(200);
  const beforeParts = splitGradeResponse(long, '初中', before.platformDefaults.languageLevels);
  assert.equal(applyGradeResponsePolicy(long, '初中', before.platformDefaults.languageLevels), long);
  assert.equal(beforeParts.join(''), long);
  assert.ok(beforeParts.every((part) => part.length <= 100));

  await fs.writeFile(
    path.join(root, '_platform', 'language-levels.md'),
    '> overridable: true\n> merge: by-key\n\n## 初中\n\n- 字数：20–30\n- 硬上限：40\n- 句式：只说一件事\n',
    'utf8',
  );
  const after = await compileCourse({ lessonsRoot: root, courseId: 'lesson_gewu_001' });

  assert.match(promptFor(after, '初中'), /初中：20–30字为主，只说一件事。/);
  const afterParts = splitGradeResponse(long, '初中', after.platformDefaults.languageLevels);
  assert.equal(afterParts.join(''), long);
  assert.ok(afterParts.every((part) => part.length <= 40));
  assert.equal(
    languageLevelFor(after.platformDefaults.languageLevels, '高三').limit,
    140,
    'md 里没写的档回落到代码常量',
  );
});

test('课程可以用 ## 学段规范 覆盖单档，未覆盖的键保持平台值', () => {
  const document = parsePlatformDefaultDocument(
    '> overridable: true\n> merge: by-key\n\n## 初中\n\n- 字数：50–80\n- 硬上限：100\n- 句式：鼓励先尝试\n',
    'language-levels.md',
  );
  const levels = resolveLanguageLevels(document, { 初中硬上限: '60' });

  assert.equal(levels['初中'].limit, 60);
  assert.equal(levels['初中'].words, '50–80');
  assert.equal(levels['初中'].style, '鼓励先尝试');
});

test('硬上限写成非正数或非数字时忽略，不会生成空气泡', () => {
  const document = parsePlatformDefaultDocument(
    '> overridable: true\n> merge: by-key\n\n## 初中\n\n- 硬上限：0\n',
    'language-levels.md',
  );
  assert.equal(resolveLanguageLevels(document)['初中'].limit, 100);
  assert.equal(resolveLanguageLevels(document, { 初中硬上限: '随便' })['初中'].limit, 100);
});
