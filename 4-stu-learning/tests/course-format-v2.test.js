// v2 任务单元格式契约：就地引导/脚手架/验收标准 + 能力标签。
// 重点是两件事：私有教学内容不下发浏览器；就地内容真的被装配到运行时。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileCourse, clearCourseCache } from '../server/course/compiler.js';
import { parseLesson } from '../src/engine/lesson-parser.js';
import { taskScaffoldHint } from '../server/agent/prompt.js';
import publicLessons from '../src/generated/lesson-public.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

// 在临时目录里搭一门课（含平台包，编译器要求三份底线规则存在），跑完即删。
async function withTempCourse(files, run) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lesson-compat-'));
  const courseId = 'lesson_legacy_compat';
  try {
    await fs.cp(path.join(lessonsRoot, '_platform'), path.join(tempRoot, '_platform'), { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      const target = path.join(tempRoot, courseId, name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, 'utf8');
    }
    await run(tempRoot, courseId);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
    clearCourseCache();
  }
}

// 这些键一旦出现在浏览器包里就是泄漏：引导会暴露教学策略，脚手架含逐档答案，
// 验收标准是评分细则，能力标签是评价预留数据，人设侧重是课程私有的 Prompt 配置。
const PRIVATE_KEYS = Object.freeze([
  'inlineGuidance', 'inlineScaffold', 'inlineAcceptance', 'competencyTags',
  'guidance', 'scaffold', 'acceptance', 'guide', 'keyData',
  'companion', 'personaEmphasis', 'platformDefaults',
]);

function collectKeys(value, found = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, found);
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      found.add(key);
      collectKeys(item, found);
    }
  }
  return found;
}

test('浏览器公开包不含任何就地教学内容与能力标签', () => {
  for (const [courseId, course] of Object.entries(publicLessons)) {
    const keys = collectKeys(course);
    for (const key of PRIVATE_KEYS) {
      assert.equal(keys.has(key), false, `${courseId} 的公开包泄漏私有字段 ${key}`);
    }
  }
});

test('课程源文件里的脚手架逐档话术不出现在公开包', () => {
  // L4 兜底档通常直接给出答案，是最敏感的一档。
  const serialized = JSON.stringify(publicLessons);
  assert.doesNotMatch(serialized, /##### 脚手架/);
  assert.doesNotMatch(serialized, /##### 引导/);
  assert.doesNotMatch(serialized, /##### 验收标准/);
});

test('就地引导与脚手架被装配到运行时任务上', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const tasks = course.roles.flatMap((role) => role.tasks);
  assert.equal(tasks.length, 18);
  for (const task of tasks) {
    assert.ok(task.guidance, `${task.id} 的就地引导未装配`);
    assert.ok(task.scaffold, `${task.id} 的就地脚手架未装配`);
  }
});

test('Step 级验收标准就地装配，阅卷器不再需要整份课程量规', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const steps = course.roles.flatMap((role) => role.tasks.flatMap((task) => task.steps));
  const withAcceptance = steps.filter((step) => step.acceptance);
  assert.equal(withAcceptance.length, steps.length, '故宫课每个 Step 都应有就地验收标准');
  // 就地量规必须显著短于整份 evaluation.md，否则等于没有解决整份灌注问题。
  const longest = Math.max(...withAcceptance.map((step) => step.acceptance.length));
  assert.ok(longest < course.evaluation.length, '单步验收标准不应长于整份课程量规');
});

test('格物六角色 54 个 Step 均有 L0–L4 专属脚手架，L4 只给核验框架', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const entries = course.roles.flatMap((role) => role.tasks.flatMap((task) => (
    task.steps.map((step) => ({ roleId: role.id, taskId: task.id, step }))
  )));
  assert.equal(entries.length, 54);

  const protectedAnswerPattern = /(?:1142|2%|0\.2%|52\s*米|2100\s*米|60\s*万\s*(?:m³|立方米)|水从北向南流|从西北角流入|从东南角流出|2023\s*年故宫局部积水|因势利导)/u;
  const repeatedSafetyPattern = /(?:安全|护栏|指定观察点|开放动线)/u;
  for (const { roleId, taskId, step } of entries) {
    const label = `${roleId}/${taskId}/${step.id}`;
    assert.ok(step.scaffold, `${label} 缺 Step 级脚手架`);
    for (const level of ['L0', 'L1', 'L2', 'L3', 'L4']) {
      assert.match(step.scaffold, new RegExp(`^\\|\\s*${level}\\s*\\|\\s*\\S`, 'mi'), `${label} 缺 ${level}`);
    }
    const l4 = step.scaffold.match(/^\|\s*L4\s*\|\s*(.*?)\s*\|$/mi)?.[1] || '';
    assert.match(l4, /(?:核验|检查|复核|审计|审核|框架)/u, `${label} 的 L4 缺核验语义`);
    assert.doesNotMatch(l4, protectedAnswerPattern, `${label} 的 L4 泄露保护答案`);
    assert.doesNotMatch(step.scaffold, repeatedSafetyPattern, `${label} 把工具安全提示重复进脚手架`);
  }
});

test('能力标签解析为四棵树前缀，非法前缀被丢弃', () => {
  const lesson = parseLesson({
    id: 'unit-test',
    assetBase: 'assets',
    files: {
      'course.md': [
        '# 测试课程',
        '## 基本信息',
        '- 主题模板：gewu',
        '## 学生端角色体系',
        '- collectionName：测试集合',
        '- itemName：身份',
        '- collectionItemName：符',
        '- collectionPanelName：面板',
        '- unlockTarget：终章',
        '- 任务阶段：phase-2',
      ].join('\n'),
      'phases.md': '## Phase 2：现场\n- 时长：60min',
      'roles/tester.md': [
        '# 测试角色',
        '## 基本信息',
        '- 选择说明：测试用',
        '- 收集物：符',
        '- 收集物图：tokens/a.png',
        '- 角色卡图：cards/a.png',
        '- 角色徽章图：badges/a.png',
        '## 任务列表',
        '### 任务1：验证标签',
        '- id：tag-task',
        '- 能力标签：CC-1.2, DK-03, ds-02, CQ-4, XX-9, CC-1.2',
        '- 通过条件：完成',
        '',
        '#### Step 1：一步',
        '- id：tag-step',
        '- 小步目标：目标',
        '- 学生行动：行动',
        '- 位置：none',
        '- 完成方式：user_confirm',
        '- 能力标签：DS-07',
      ].join('\n'),
    },
  });

  const task = lesson.roles[0].tasks[0];
  // 大小写归一、去重、丢弃非四棵树前缀（XX-9）
  assert.deepEqual(task.competencyTags, ['CC-1.2', 'DK-03', 'DS-02', 'CQ-4']);
  assert.deepEqual(task.steps[0].competencyTags, ['DS-07']);
});

test('就地段落不会被当作字段续行吞掉', () => {
  const lesson = parseLesson({
    id: 'unit-test',
    assetBase: 'assets',
    files: {
      'course.md': [
        '# 测试课程',
        '## 基本信息',
        '- 主题模板：gewu',
        '## 学生端角色体系',
        '- collectionName：测试集合',
        '- itemName：身份',
        '- collectionItemName：符',
        '- collectionPanelName：面板',
        '- unlockTarget：终章',
        '- 任务阶段：phase-2',
      ].join('\n'),
      'phases.md': '## Phase 2：现场\n- 时长：60min',
      'roles/tester.md': [
        '# 测试角色',
        '## 基本信息',
        '- 选择说明：测试用',
        '- 收集物：符',
        '- 收集物图：tokens/a.png',
        '- 角色卡图：cards/a.png',
        '- 角色徽章图：badges/a.png',
        '## 任务列表',
        '### 任务1：边界验证',
        '- id：edge-task',
        '- 通过条件：完成本任务',
        '',
        '##### 引导',
        '任务级引导正文。',
        '',
        '#### Step 1：一步',
        '- id：edge-step',
        '- 小步目标：目标',
        '- 学生行动：行动',
        '- 位置：none',
        '- 完成方式：user_confirm',
        '- 证据要求：提交一条记录',
        '',
        '##### 脚手架',
        '| L1 | 第一档提示 |',
        '| L4 | 兜底档提示 |',
        '',
        '##### 验收标准',
        '本步验收正文。',
      ].join('\n'),
    },
  });

  const task = lesson.roles[0].tasks[0];
  const step = task.steps[0];
  // 最后一个字段的值不能把后面的标题正文吞进来
  assert.equal(step.evidenceRequirement, '提交一条记录');
  assert.equal(task.inlineGuidance, '任务级引导正文。');
  assert.equal(step.acceptance, '本步验收正文。');
  assert.match(step.scaffold, /第一档提示/);
});

test('双格式兼容期：旧布局（独立 guidance/scaffolds 目录）仍能装配', () => {
  // 存量 5 门课已全部迁移，回退分支在仓库里没有真实样本；
  // 这条测试用最小旧布局锁定它，兼容期关闭时连同 compiler 的回退分支一起删。
  const files = {
    'course.md': [
      '# 旧布局课程',
      '## 基本信息',
      '- 主题模板：gewu',
      '## 学生端角色体系',
      '- collectionName：集合',
      '- itemName：身份',
      '- collectionItemName：符',
      '- collectionPanelName：面板',
      '- unlockTarget：终章',
      '- 任务阶段：phase-2',
    ].join('\n'),
    'phases.md': '## Phase 2：现场\n- 时长：60min',
    'roles/legacy.md': [
      '# 旧角色',
      '## 基本信息',
      '- 选择说明：测试用',
      '- 收集物：符',
      '- 收集物图：tokens/a.png',
      '- 角色卡图：cards/a.png',
      '- 角色徽章图：badges/a.png',
      '## 任务列表',
      '### 任务1：旧任务',
      '- id：legacy-task',
      '- 通过条件：完成',
      '',
      '#### Step 1：一步',
      '- id：legacy-step',
      '- 小步目标：目标',
      '- 学生行动：行动',
      '- 位置：none',
      '- 完成方式：user_confirm',
    ].join('\n'),
    'guidance/legacy.md': '# 旧角色引导\n\n## 任务1：旧任务\n### 引导目标\n旧布局的引导正文。',
    'scaffolds/legacy.md': '# 旧角色脚手架\n\n## 任务1：旧任务\n\n| L1 | 旧布局的一档提示 |',
  };

  return withTempCourse(files, async (tempRoot, courseId) => {
    clearCourseCache();
    const course = await compileCourse({ lessonsRoot: tempRoot, courseId });
    const task = course.roles[0].tasks[0];
    // 解析层不做跨文件装配：就地字段为空，装配结果来自旧目录
    assert.equal(task.inlineGuidance, '');
    assert.match(task.guidance, /旧布局的引导正文/);
    assert.match(task.scaffold, /旧布局的一档提示/);
    // 取档也应命中旧布局内容
    assert.match(taskScaffoldHint(task, 0), /旧布局的一档提示/);
  });
});

test('课程侧标签（DK/DS/DC）都在本课 objectives.md 中有定义', async () => {
  for (const courseId of ['lesson_gewu_001', 'lesson_zhuhun_001']) {
    clearCourseCache();
    const course = await compileCourse({ lessonsRoot, courseId });
    const defined = new Set(
      [...(course.files['objectives.md'] || '').matchAll(/^[-*]\s*((?:DK|DS|DC)-\d+)\b/gm)]
        .map((match) => match[1]),
    );
    assert.ok(defined.size > 0, `${courseId} 的 objectives.md 未定义任何课程侧标签`);
    const used = new Set(
      course.roles
        .flatMap((role) => role.tasks)
        .flatMap((task) => [...(task.competencyTags || []), ...task.steps.flatMap((s) => s.competencyTags || [])])
        .filter((tag) => /^(?:DK|DS|DC)-/.test(tag)),
    );
    for (const tag of used) {
      assert.ok(defined.has(tag), `${courseId} 使用了未定义的课程侧标签 ${tag}`);
    }
  }
});

test('脚手架取档覆盖 L0–L4，缺档向下取最近一档', () => {
  const task = { id: 't', scaffold: '| L1 | 一档 |\n| L4 | 兜底 |', steps: [] };
  // scaffoldLevel + 1 为目标档：L3 → 目标 L4 命中兜底
  assert.match(taskScaffoldHint(task, 3), /兜底/);
  // 目标 L4 存在时不应回落到 L1
  assert.doesNotMatch(taskScaffoldHint(task, 4), /一档/);
  // 目标 L3 缺档 → 向下取 L1
  assert.match(taskScaffoldHint(task, 2), /一档/);
  // Step 级优先于任务级
  const step = { scaffold: '| L2 | 步级提示 |' };
  assert.match(taskScaffoldHint(task, 1, 0, step), /步级提示/);
});
