import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLesson } from '../src/engine/lesson-parser.js';
import { resolveScaffolding } from '../server/course/platform-defaults.js';
import { renderVoice, resolveVoice } from '../server/course/voice.js';
import { parsePlatformDefaultDocument } from '../src/engine/platform-defaults.js';

// 2026-08 把课程与平台 md 里的「缺省」统一改成「默认」。改名只该影响措辞，不该影响解析：
// 存量课程写的旧名如果读不到，表现是"我明明配了却没生效"——静默、且最难查。
// 这一组锁的就是四个字面标记的旧名仍然生效。等五门课都改完再连同兼容代码一起删。

const ROLE_MARKDOWN = [
  '# 侦察员',
  '',
  '## 基本信息',
  '',
  '- 收集物：线索',
  '- 收集物图：a.png',
  '- 角色卡图：b.png',
  '- 角色徽章图：c.png',
  '- 选择说明：看现场',
  '',
  '### 任务1：看水面',
  '',
  '- 通过条件：说出一处观察',
  '',
].join('\n');

const BASE_COURSE = [
  '# 旧名兼容测试课',
  '',
  '## 基本信息',
  '',
  '- 主题模板：test',
  '',
  '## 学生端角色体系',
  '',
  '- collectionName：合集',
  '- itemName：物件',
  '- collectionItemName：物件',
  '- collectionPanelName：面板',
  '- unlockTarget：终章',
  '- 任务阶段：phase-2',
  '',
].join('\n');

function lessonSource(extraCourseSections) {
  return {
    id: 'lesson_legacy_names',
    assetBase: 'assets',
    files: {
      'course.md': `${BASE_COURSE}\n${extraCourseSections}`,
      'phases.md': '',
      'roles/scout.md': ROLE_MARKDOWN,
    },
  };
}

function firstTask(lesson) {
  return lesson.roles[0].tasks[0];
}

test('course.md 的旧小节名 `## 数值缺省` 仍然生效', () => {
  const lesson = parseLesson(lessonSource('## 数值缺省\n\n- 无操作提醒：7分钟\n- 建议时长：25分钟\n'));
  const task = firstTask(lesson);
  assert.equal(task.timing.idleNudgeSeconds, 7 * 60, '旧名读不到会让课程配的值静默回落到平台默认');
  assert.equal(task.timing.suggestedSeconds, 25 * 60);
});

test('新名 `## 数值默认` 生效，且两节同写时以新名为准', () => {
  const current = parseLesson(lessonSource('## 数值默认\n\n- 无操作提醒：9分钟\n'));
  assert.equal(firstTask(current).timing.idleNudgeSeconds, 9 * 60);

  const both = parseLesson(lessonSource(
    '## 数值默认\n\n- 无操作提醒：9分钟\n\n## 数值缺省\n\n- 无操作提醒：7分钟\n',
  ));
  assert.equal(firstTask(both).timing.idleNudgeSeconds, 9 * 60, '迁移期两节并存时，新名是权威');
});

// 工具显示名要经由任务上的工具模块才看得见，所以这个角色多带一个 A01 模块。
function lessonWithTool(extraCourseSections) {
  const source = lessonSource(extraCourseSections);
  source.files['roles/scout.md'] = ROLE_MARKDOWN.replace(
    '- 通过条件：说出一处观察\n',
    '- 通过条件：说出一处观察\n- 功能模块：A01（拍照）\n',
  );
  return source;
}

test('course.md 的旧小节名 `## 工具缺省` 仍然覆盖工具显示名', () => {
  const photoName = (lesson) => firstTask(lesson).tools.find((tool) => tool.id === 'photo')?.name;

  const legacy = parseLesson(lessonWithTool('## 工具缺省\n\n- photo：拍照取证\n'));
  const current = parseLesson(lessonWithTool('## 工具默认\n\n- photo：拍照取证\n'));

  assert.equal(photoName(legacy), '拍照取证', '旧名读不到会让课程改的工具名静默回到平台默认');
  assert.equal(photoName(current), '拍照取证');
});

test('scaffolding 的旧键名「缺省提示」仍然生效', () => {
  const legacy = parsePlatformDefaultDocument(
    '> overridable: true\n> merge: by-key\n\n- 缺省提示：先说说你看到了什么。\n',
    'scaffolding.md',
  );
  assert.equal(resolveScaffolding(legacy).scaffolding.fallbackHint, '先说说你看到了什么。');

  const current = parsePlatformDefaultDocument(
    '> overridable: true\n> merge: by-key\n\n- 默认提示：先说说你看到了什么。\n',
    'scaffolding.md',
  );
  assert.equal(resolveScaffolding(current).scaffolding.fallbackHint, '先说说你看到了什么。');
});

test('话术旧键名 `补充缺省语` 的课程覆盖不被当成未知键丢掉', () => {
  const { voice, warnings } = resolveVoice(null, { 'task_step_completed.补充缺省语': '这一步再补一点。' });

  assert.deepEqual(warnings, [], '旧键被判成未知键时会静默忽略，学生看到的是平台默认那句');
  assert.equal(renderVoice(voice, 'task_step_completed.补充默认语'), '这一步再补一点。');
});

test('_platform/voice.md 里写旧键名也能读到', () => {
  const document = parsePlatformDefaultDocument(
    '> overridable: true\n> merge: by-key\n\n- task_step_completed.补充缺省语：这一步还差一点。\n',
    'voice.md',
  );
  const { voice } = resolveVoice(document, {});
  assert.equal(renderVoice(voice, 'task_step_completed.补充默认语'), '这一步还差一点。');
});
