import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseLesson } from '../src/engine/lesson-parser.js';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { buildTaskGraph, traversalOrder } from '../server/course/task-graph.js';
import { toPublic } from '../server/course/projections.js';
import { exitCodeForIssues, lintCourse } from '../scripts/lint-lesson.mjs';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

// lint 的负例要改编译产物，但 course 被 compileCourse 缓存着——直接改会污染同进程后续用例。
// 深拷贝出需要的那几支：lesson.phases（阶段任务）、roles（错位检查）、files['phases.md']（行号定位）。
function lintFixture(course) {
  return structuredClone({
    id: course.id,
    knowledge: course.knowledge,
    restrictionMarkdown: course.restrictionMarkdown,
    restrictionDocument: course.restrictionDocument,
    roles: course.roles,
    lesson: { phases: course.lesson.phases },
    files: { 'phases.md': course.files['phases.md'] },
    documentSources: course.documentSources,
  });
}

// 阶段任务（非角色任务）：全班看导入短片、小组拼合、个人反思。
// 这类内容此前无处安放——任务只能写在 roles/<role>.md，于是课程作者会把集体任务
// 塞进某个角色的 Step，六个角色各看一遍视频。本组锁的是"能写、能编译、能校验、能进图"，
// **不含执行**：运行时推进仍是 currentTaskIndex += 1，阶段任务不参与（R3 接）。

const BASE_COURSE = [
  '# 阶段任务测试课', '',
  '## 基本信息', '', '- 主题模板：test', '',
  '## 学生端角色体系', '',
  '- collectionName：合集', '- itemName：物件', '- collectionItemName：物件',
  '- collectionPanelName：面板', '- unlockTarget：终章', '- 任务阶段：phase-1', '',
].join('\n');

const ROLE_MARKDOWN = [
  '# 侦察员', '',
  '## 基本信息', '',
  '- 收集物：线索', '- 收集物图：a.png', '- 角色卡图：b.png',
  '- 角色徽章图：c.png', '- 选择说明：看现场', '',
  '### 任务1：看水面', '', '- 通过条件：说出一处观察', '',
].join('\n');

function lessonWith(phasesMarkdown, onWarning) {
  return parseLesson({
    id: 'lesson_phase_tasks',
    assetBase: 'assets',
    files: { 'course.md': BASE_COURSE, 'phases.md': phasesMarkdown, 'roles/scout.md': ROLE_MARKDOWN },
  }, { onWarning });
}

test('阶段任务被解析成可执行单元，执行单位三值都认', () => {
  const lesson = lessonWith([
    '## Phase 1：沉浸叙事', '- 时长：20min', '',
    '### 阶段任务1：看导入短片', '- 执行单位：全班', '- 功能模块：A06(沉浸媒体)', '- 完成方式：tool_result', '',
    '### 阶段任务2：小组拼合发现', '- 执行单位：小组', '- 功能模块：A03(拼合搭建)', '',
    '### 阶段任务3：写下你的猜想', '- 执行单位：个人', '- 功能模块：A01(文字)', '',
  ].join('\n'));

  const tasks = lesson.phases[0].tasks;
  assert.equal(tasks.length, 3);
  assert.deepEqual(tasks.map((task) => task.executor), ['全班', '小组', '个人']);
  assert.deepEqual(tasks.map((task) => task.name), ['看导入短片', '小组拼合发现', '写下你的猜想']);
  assert.deepEqual(tasks.map((task) => task.tools[0]?.id), ['media', 'builder', 'text']);
  assert.deepEqual(tasks.map((task) => task.scope), ['phase', 'phase', 'phase']);
  // id 自带 phase 前缀：角色任务的 id 跨角色重复，同一张图里不带作用域会静默塌掉。
  assert.deepEqual(tasks.map((task) => task.id), ['phase-1-task-1', 'phase-1-task-2', 'phase-1-task-3']);
});

test('阶段任务不写执行单位时默认全班；写错值告警并落回全班', () => {
  const warnings = [];
  const lesson = lessonWith([
    '## Phase 1：入场', '',
    '### 阶段任务1：没写执行单位', '- 功能模块：A01(文字)', '',
    '### 阶段任务2：写错了', '- 执行单位：全组', '',
  ].join('\n'), (warning) => warnings.push(warning));

  assert.deepEqual(lesson.phases[0].tasks.map((task) => task.executor), ['全班', '全班']);
  const executorWarnings = warnings.filter((item) => item.code === 'bad_phase_task_executor');
  assert.equal(executorWarnings.length, 1, '只有写错的那一条该告警，没写的走默认不算错');
  assert.match(executorWarnings[0].message, /全组/);
});

test('阶段任务不被当成角色任务，Phase 自己的字段也不被抢走', () => {
  const lesson = lessonWith([
    '## Phase 1：沉浸叙事', '- 时长：20min', '- 模式：集体（全班）', '',
    '### 流程', '1. 播放短片', '2. 收集猜想', '',
    // 短片自己有 3min，Phase 是 20min：两者不能混。
    '### 阶段任务1：看短片', '- 执行单位：全班', '- 建议时长：3min', '',
  ].join('\n'));

  const phase = lesson.phases[0];
  assert.equal(phase.duration, '20min', '阶段任务里的同名字段不能抢走 Phase 的时长');
  assert.deepEqual(phase.flow, ['播放短片', '收集猜想'], '### 流程 仍是给教师看的叙述，不被阶段任务吞掉');
  assert.equal(lesson.roles[0].tasks.length, 1, '角色任务数不受影响');
  assert.equal(lesson.roles[0].tasks[0].name, '看水面');
});

test('阶段任务进任务图，但不进任何角色的遍历', () => {
  const roles = [{ id: 'scout', tasks: [{ id: 'task-1', steps: [{ id: 's1', next: 'role-stage:complete' }] }] }];
  const phases = [{ id: 'phase-1', tasks: [{ id: 'phase-1-task-1', executor: '全班', steps: [] }] }];
  const graph = buildTaskGraph(roles, phases);

  assert.equal(graph.nodes.size, 2);
  assert.ok(graph.nodes.has('phase-1/phase-1-task-1'), '阶段节点键带阶段前缀');
  assert.equal(graph.nodes.get('phase-1/phase-1-task-1').roleId, '', '阶段任务不属于任何角色');
  assert.deepEqual(
    traversalOrder(graph, 'scout'),
    ['scout/task-1'],
    '角色遍历必须只含角色任务，否则 R3 换成读图时学生会被塞进集体任务',
  );
  assert.deepEqual(graph.warnings, []);
});

test('6 门课的角色任务节点数与终止节点数不受阶段任务影响', async () => {
  clearCourseCache();
  const courseIds = ['lesson_gewu_001', 'lesson_youyi_001', 'lesson_zhizhi_001', 'lesson_zhizhi_002', 'lesson_zhizhi_003', 'lesson_zhuhun_001'];
  let roleNodes = 0;

  for (const courseId of courseIds) {
    const course = await compileCourse({ lessonsRoot, courseId });
    roleNodes += [...course.taskGraph.nodes.values()].filter((node) => node.scope === 'role').length;
    for (const role of course.roles) {
      assert.deepEqual(
        traversalOrder(course.taskGraph, role.id),
        role.tasks.map((task) => `${role.id}/${task.id}`),
        `${courseId}/${role.id}：遍历顺序必须仍与线性推进等价`,
      );
    }
  }
  assert.equal(roleNodes, 103, '角色任务仍是 103 个节点');
});

test('lesson_gewu_001 的 Phase 1 保留一个领角色前任务，其余阶段仍为空', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const [first, ...rest] = course.lesson.phases;

  assert.equal(first.tasks.length, 1);
  assert.deepEqual(first.tasks.map((task) => task.executor), ['全班']);
  assert.equal(first.tasks[0].tools[0].id, 'media');
  assert.equal(first.tasks[0].tools[0].config.url, '', '正式短片素材仍缺失，lint 必须保持发布红灯');
  assert.equal(first.flow.length, 0, '流程文字已从结构化阶段配置清理');
  assert.equal(first.duration, '20分钟');
  assert.deepEqual(rest.map((phase) => phase.tasks.length), [0, 0, 0, 0, 0], '只迁移了 Phase 1');
});

test('阶段任务的就地教学内容与能力标签不进浏览器包', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const task = course.lesson.phases[0].tasks[0];
  // 前提：源文件里这些字段确实有内容，否则这条测试是空转。
  assert.ok(task.inlineAcceptance, '前提：阶段任务写了就地验收标准');
  assert.ok(task.guide, '前提：阶段任务写了 AI 引导方向');
  assert.ok(task.toolParameters, '前提：阶段任务写了工具参数');

  const publicTask = toPublic(course.lesson, course.restrictionMarkdown).phases[0].tasks[0];
  for (const key of ['inlineGuidance', 'inlineScaffold', 'inlineAcceptance', 'competencyTags', 'guide', 'toolParameters']) {
    assert.equal(key in publicTask, false, `公开投影仍带 ${key}`);
  }
});

test('其他课程只在有真实入场活动时配置 Phase 1 可执行任务', async () => {
  clearCourseCache();
  const expectedCounts = {
    lesson_youyi_001: 0,
    lesson_zhizhi_001: 1,
    lesson_zhizhi_002: 1,
    lesson_zhizhi_003: 1,
    lesson_zhuhun_001: 1,
  };
  for (const [courseId, expected] of Object.entries(expectedCounts)) {
    const course = await compileCourse({ lessonsRoot, courseId });
    const phaseTasks = course.lesson.phases.flatMap((phase) => phase.tasks || []);
    assert.equal(phaseTasks.length, expected, `${courseId} 入口任务数量不符合迁移结果`);
    assert.ok(phaseTasks.every((task) => task.phaseId === 'phase-1'));
    assert.ok(phaseTasks.every((task) => task.finalizationMode === 'auto_on_last_step'));
    assert.equal(
      [...course.taskGraph.nodes.values()].filter((node) => node.scope === 'phase').length,
      expected,
      `${courseId} 的阶段任务必须与图节点一致`,
    );
  }
});

test('lint 在阶段任务缺验收时仍报到 course.md 阶段编排的正确行号', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const fixture = lintFixture(course);
  fixture.lesson.phases[0].tasks[0].acceptance = '';
  fixture.lesson.phases[0].tasks[0].inlineAcceptance = '';
  const { issues } = lintCourse(fixture, { lessonsRoot, courseId: course.id });
  const missing = issues.filter((item) => item.code === 'missing_acceptance' && item.file.endsWith('course.md'));

  assert.equal(missing.length, 1);
  const phasesMarkdown = course.files['phases.md'].split('\n');
  for (const issue of missing) {
    assert.match(phasesMarkdown[issue.line - 1], /^###\s*阶段任务\d+[：:]/, `第 ${issue.line} 行不是阶段任务标题`);
  }
});

test('执行单位非法报 error 并指到那一行', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const fixture = lintFixture(course);
  fixture.lesson.phases[0].tasks[0].executor = '全组';

  const { issues, stats } = lintCourse(fixture, { lessonsRoot, courseId: course.id });
  const bad = issues.filter((item) => item.code === 'bad_executor');
  assert.equal(bad.length, 1);
  assert.equal(bad[0].level, 'error', '静默落回默认最难查，必须是 error 不是 warning');
  assert.equal(bad[0].file, '6-lessons/lesson_gewu_001/course.md');
  assert.equal(course.files['phases.md'].split('\n')[bad[0].line - 1].trim(), '- 执行单位：全班');
  assert.equal(stats.badExecutors, 1);
  assert.equal(exitCodeForIssues(issues), 1);
});

test('阶段任务写进角色文件报 error：那里谁都不解析它', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const fixture = lintFixture(course);
  const role = fixture.roles[0];
  role.sourceMarkdown = `${role.sourceMarkdown}\n### 阶段任务1：放错地方的集体任务\n- 执行单位：全班\n`;

  const { issues, stats } = lintCourse(fixture, { lessonsRoot, courseId: course.id });
  const misplaced = issues.filter((item) => item.code === 'phase_task_in_role_file');
  assert.equal(misplaced.length, 1);
  assert.equal(misplaced[0].level, 'error');
  assert.equal(misplaced[0].file, `6-lessons/lesson_gewu_001/roles/${role.id}.md`);
  assert.equal(role.sourceMarkdown.split('\n')[misplaced[0].line - 1], '### 阶段任务1：放错地方的集体任务');
  assert.equal(stats.misplacedPhaseTasks, 1);
});

test('阶段任务的死素材引用报 error', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const fixture = lintFixture(course);
  // 用 ASCII 文件名：素材扫描正则只认 ASCII 路径，实测 5 门课的素材文件名也全是 ASCII。
  fixture.lesson.phases[0].tasks[0].tools[0].config.poster = 'lessons/lesson_gewu_001/assets/videos/video-does-not-exist.png';

  const { issues } = lintCourse(fixture, { lessonsRoot, courseId: course.id });
  const missing = issues.filter((item) => item.code === 'missing_asset');
  assert.equal(missing.length, 1);
  assert.equal(missing[0].level, 'error');
  assert.equal(missing[0].file, '6-lessons/lesson_gewu_001/course.md');
});

test('已生成的浏览器课程包里不含阶段任务的答案性内容', async () => {
  const source = await fs.readFile(new URL('../src/generated/lesson-public.js', import.meta.url), 'utf8');
  // phases 是整份下发浏览器的，toPublic 从前完全不碰它——这条是那个缺口的回归锁。
  for (const forbidden of ['有明确判断', '只收猜想不做对错评判', '先不管对不对', 'DS-01', 'DC-01']) {
    assert.equal(source.includes(forbidden), false, `公开课程包包含阶段任务的私有内容 ${forbidden}`);
  }
  assert.ok(source.includes('查看\\"暴雨将至\\"情境图'), '任务名本身应该下发，学生要看得到');
});
