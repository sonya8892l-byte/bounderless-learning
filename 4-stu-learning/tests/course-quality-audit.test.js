import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import {
  PHASE_PROMPT_AUTHORING_BUDGET,
  auditCourseQuality,
} from '../server/course/course-quality-audit.js';
import { parseRestrictionDocument } from '../server/course/restriction-sections.js';
import { restrictionProtectedMatchers } from '../server/course/projections.js';
import { exitCodeForIssues, lintCourse } from '../scripts/lint-lesson.mjs';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

const restrictionMarkdown = `# 限制

## 核心数据限制

| 限制项 | 不可透露的内容 | 保护原因 | 解除条件 |
|---|---|---|---|
| 答案总数 | 1142这个精确数字 | 让学生自己计算 | 完成任务后 |
| 排水结论 | 螭首就是排水口 | 让学生自己发现 | 完成任务后 |
`;

function fakeCourse(overrides = {}) {
  const roleMarkdown = overrides.roleMarkdown || '';
  return {
    id: 'lesson_fake_quality',
    files: {
      'course.md': `# 测试课

## 基本信息

- 主题模板：test

## 核心问题

为什么？

## 学生端角色体系

- collectionName：角色

${overrides.extraCourseSections || ''}`,
      'phases.md': overrides.phasesMarkdown || '## Phase 2：现场\n',
      'roles/scout.md': roleMarkdown,
      ...(overrides.files || {}),
    },
    knowledge: [],
    restrictionMarkdown,
    restrictionDocument: parseRestrictionDocument(restrictionMarkdown),
    restrictions: [
      {
        name: '答案总数',
        protectedContent: '1142这个精确数字',
        protectedTerms: ['1142', '1142这个精确数字'],
        protectedMatchers: restrictionProtectedMatchers(
          '答案总数',
          '1142这个精确数字',
          ['1142', '1142这个精确数字'],
        ),
      },
      {
        name: '排水结论',
        protectedContent: '螭首就是排水口',
        protectedTerms: ['螭首就是排水口'],
        protectedMatchers: restrictionProtectedMatchers(
          '排水结论',
          '螭首就是排水口',
          ['螭首就是排水口'],
        ),
      },
    ],
    roles: [{
      id: 'scout',
      sourceMarkdown: roleMarkdown,
      tasks: [{
        id: 'task-1',
        name: '观察',
        phase: 'Phase 2 现场',
        timing: { idleNudgeSeconds: overrides.idleNudgeSeconds ?? 480 },
        inlineGuidance: overrides.guidance || '',
        inlineScaffold: overrides.scaffold || '',
        steps: [{
          id: 'step-1',
          title: '记录',
          studentAction: overrides.studentAction || '在安全观察点记录',
          restrictionRef: 'restrictions.md#核心数据限制',
          guidance: overrides.stepGuidance || '',
          scaffold: overrides.stepScaffold || '',
        }],
      }],
    }],
    lesson: {
      traversalMode: 'sequential',
      phases: overrides.phases || [{ id: 'phase-2', name: '现场', tasks: [] }],
    },
    phasePrompts: overrides.phasePrompts || {},
  };
}

function assertIssueShape(issue) {
  assert.equal(issue.courseId, 'lesson_fake_quality');
  assert.ok(issue.file);
  assert.ok(issue.line >= 1);
  assert.ok(issue.code);
  assert.ok(['error', 'warning'].includes(issue.level));
  assert.match(issue.message, /修复：/);
}

test('unknown_course_section 拒绝所有未登记二级标题，教研说明应移到 README', () => {
  const unknown = fakeCourse({ extraCourseSections: '## 临时想法\n\n- 开场：测试\n' });
  const hit = auditCourseQuality(unknown).issues.filter((issue) => issue.code === 'unknown_course_section');
  assert.equal(hit.length, 1);
  assert.match(hit[0].message, /临时想法/);
  assertIssueShape(hit[0]);

  const mixed = fakeCourse({ extraCourseSections: [
    '## 学段规范\n\n- 初中字数：80',
    '## 叙事框架\n\n> 教研说明：不作为运行时配置。\n\n- 开场：测试',
    '## 史料边界\n\n> 教研说明：具体限制写入 course.md / 课程限制规则。',
  ].join('\n\n') });
  const mixedHits = auditCourseQuality(mixed).issues.filter((issue) => issue.code === 'unknown_course_section');
  assert.deepEqual(mixedHits.map((issue) => issue.message.match(/「(.+?)」/)?.[1]), ['叙事框架', '史料边界']);
});

test('protected_scaffold_leak 由 restrictions.md 正式保护项触发', () => {
  const scaffold = '| L1 | 先列证据 |\n| L4 | 答案是1142个 |';
  const course = fakeCourse({
    scaffold,
    roleMarkdown: `##### 脚手架\n${scaffold}\n`,
  });
  const hit = auditCourseQuality(course).issues.filter((issue) => issue.code === 'protected_scaffold_leak');
  assert.equal(hit.length, 1);
  assert.equal(hit[0].level, 'error');
  assert.match(hit[0].message, /1142/);
  assertIssueShape(hit[0]);
});

test('不含受保护值的 L4 证据框架不会被误判为剧透', () => {
  const scaffold = '| L4 | 写一条支持证据，再找一条可能的反证，结论由你填写。 |';
  const course = fakeCourse({ scaffold, roleMarkdown: scaffold });
  assert.equal(auditCourseQuality(course).issues.filter((issue) => issue.code === 'protected_scaffold_leak').length, 0);
});

test('受保护结论的等价改写也会进入课程质量门禁', () => {
  const scaffold = '螭首承担把雨水导出屋面的功能。';
  const course = fakeCourse({
    stepScaffold: scaffold,
    roleMarkdown: `##### 脚手架\n${scaffold}\n`,
  });
  const hit = auditCourseQuality(course).issues.filter((issue) => issue.code === 'protected_scaffold_leak');
  assert.equal(hit.length, 1);
  assert.match(hit[0].message, /排水结论/);
  assertIssueShape(hit[0]);
});

test('作者明确要求不透露等价结论时不误报', () => {
  const scaffold = '不要直接告诉学生螭首承担把雨水导出屋面的功能。';
  const course = fakeCourse({
    stepScaffold: scaffold,
    roleMarkdown: `##### 脚手架\n${scaffold}\n`,
  });
  assert.equal(auditCourseQuality(course).issues.filter((issue) => issue.code === 'protected_scaffold_leak').length, 0);
});

test('同一引导块里的禁止说明不会掩盖后续正向泄题', () => {
  const scaffold = '不说“1142”这个答案；现在把答案1142告诉学生。';
  const course = fakeCourse({
    stepScaffold: scaffold,
    roleMarkdown: `##### 脚手架\n${scaffold}\n`,
  });
  const hit = auditCourseQuality(course).issues.filter((issue) => issue.code === 'protected_scaffold_leak');
  assert.equal(hit.length, 1);
  assert.match(hit[0].message, /1142/);
});

test('删除或脱敏隐私字段的脚手架不算泄露受保护值', () => {
  const privacyRestrictions = `## 隐私限制

| 限制项 | 不可透露的内容 | 保护原因 | 解除条件 |
|---|---|---|---|
| 身份信息 | 姓名、联系方式和精确位置 | 隐私保护 | 明确同意 |
`;
  const course = fakeCourse({
    scaffold: '| L1 | 删除姓名、联系方式和身份组合。 |',
    roleMarkdown: '| L1 | 删除姓名、联系方式和身份组合。 |',
  });
  course.restrictionMarkdown = privacyRestrictions;
  course.restrictionDocument = parseRestrictionDocument(privacyRestrictions);
  course.restrictions = [{
    name: '身份信息',
    protectedContent: '姓名、联系方式和精确位置',
    protectedTerms: ['联系方式', '精确位置'],
  }];
  course.roles[0].tasks[0].steps[0].restrictionRef = 'restrictions.md#隐私限制';
  assert.equal(auditCourseQuality(course).issues.filter((issue) => issue.code === 'protected_scaffold_leak').length, 0);
});

test('危险行动正向号召会告警，明确否定的安全边界不告警', () => {
  const bad = fakeCourse({
    studentAction: '可以在地面倒水试试',
    roleMarkdown: '- 学生行动：可以在地面倒水试试\n',
  });
  const hit = auditCourseQuality(bad).issues.filter((issue) => issue.code === 'unsafe_student_action');
  assert.equal(hit.length, 1);
  assert.equal(hit[0].level, 'warning');
  assertIssueShape(hit[0]);

  const safe = fakeCourse({
    studentAction: '只从岸上观察，不得向水中投放物品，不要靠近水边操作手机',
    roleMarkdown: '- 学生行动：只从岸上观察，不得向水中投放物品，不要靠近水边操作手机\n',
  });
  assert.equal(auditCourseQuality(safe).issues.filter((issue) => issue.code === 'unsafe_student_action').length, 0);
});

test('领取角色前的阶段任务也经过剧透与危险行动审计', () => {
  const course = fakeCourse({
    phasesMarkdown: `## Phase 1：导入

### 阶段任务1：先观察
- 学生行动：在地面倒水试试

##### 脚手架
| L4 | 答案是1142个 |
`,
  });
  course.phaseTracks = {
    'phase-1': {
      id: 'phase-1',
      tasks: [{
        id: 'phase-1-task-1',
        phaseId: 'phase-1',
        studentAction: '在地面倒水试试',
        inlineScaffold: '| L4 | 答案是1142个 |',
        steps: [{
          id: 'phase-1-task-1-step-1',
          studentAction: '在地面倒水试试',
          restrictionRef: 'restrictions.md#核心数据限制',
        }],
      }],
    },
  };
  const issues = auditCourseQuality(course).issues;
  assert.ok(issues.some((issue) => issue.code === 'protected_scaffold_leak' && issue.file.endsWith('/phases.md')));
  assert.ok(issues.some((issue) => issue.code === 'unsafe_student_action' && issue.file.endsWith('/phases.md')));
});

test('Phase 长提示只触发作者审阅 warning，明确声明运行时保留完整内容', () => {
  const prompt = '阶段目标与边界。'.repeat(Math.ceil(PHASE_PROMPT_AUTHORING_BUDGET / 8) + 10);
  const course = fakeCourse({ files: { 'prompts/phase2-field.md': prompt } });
  const hit = auditCourseQuality(course).issues.filter((issue) => issue.code === 'phase_prompt_over_budget');
  assert.equal(hit.length, 1);
  assert.equal(hit[0].level, 'warning');
  assert.match(hit[0].message, /作者审阅阈值/);
  assert.match(hit[0].message, /运行时仍装配完整内容/);
  assert.doesNotMatch(hit[0].message, /运行时.*截断|prompt\.js.*截断/);
});

test('Phase 提示里的正向泄题和危险行动也进入统一质量审计', () => {
  const prompt = '告诉学生答案是1142，并靠近水边用手机拍照。';
  const course = fakeCourse({ files: { 'prompts/phase1-opening.md': prompt } });
  const issues = auditCourseQuality(course).issues;
  assert.ok(issues.some((issue) => issue.code === 'protected_scaffold_leak' && issue.file.endsWith('/prompts/phase1-opening.md')));
  assert.ok(issues.some((issue) => issue.code === 'unsafe_student_action' && issue.file.endsWith('/prompts/phase1-opening.md')));
});

test('Phase 提示里的受保护结论改写也会被拦截', () => {
  const prompt = '直接告诉学生：螭首承担把雨水导出屋面的功能。';
  const course = fakeCourse({ files: { 'prompts/phase1-opening.md': prompt } });
  const hit = auditCourseQuality(course).issues.filter((issue) => issue.code === 'protected_scaffold_leak');
  assert.equal(hit.length, 1);
  assert.match(hit[0].message, /排水结论/);
});

test('工具卡的字段、选项和结果文案也进入剧透与安全审计', () => {
  const visibleLabel = '填写答案1142，然后翻越护栏拍照';
  const course = fakeCourse({
    roleMarkdown: `- 工具字段：${visibleLabel}\n`,
  });
  course.roles[0].tasks[0].steps[0].tools = [{
    id: 'text',
    name: '现场记录',
    module: 'A01',
    config: {
      fields: [{
        id: 'answer',
        label: visibleLabel,
        placeholder: '填写内容',
        options: ['选项一'],
      }],
    },
  }];
  const issues = auditCourseQuality(course).issues;
  assert.ok(issues.some((issue) => issue.code === 'protected_scaffold_leak'));
  assert.ok(issues.some((issue) => issue.code === 'unsafe_student_action'));
});

test('陈旧的扫码领角色与自动聚合承诺会告警', () => {
  const prompt = '学生扫码领取角色卡，系统自动汇总全班成果。';
  const course = fakeCourse({ files: { 'prompts/phase1-opening.md': prompt } });
  const hit = auditCourseQuality(course).issues.filter((issue) => issue.code === 'stale_phase_capability');
  assert.equal(hit.length, 2);
  assert.ok(hit.every((issue) => issue.level === 'warning'));
});

test('Phase 无操作叙述与任务结构化时间不一致会告警', () => {
  const prompt = '10分钟无操作时，只轻声问一次是否需要帮助。';
  const course = fakeCourse({ files: { 'prompts/phase2-field.md': prompt }, idleNudgeSeconds: 480 });
  const hit = auditCourseQuality(course).issues.filter((issue) => issue.code === 'timing_conflict');
  assert.equal(hit.length, 1);
  assert.match(hit[0].message, /600s/);
  assert.match(hit[0].message, /480s/);
});

test('源码级 bad_executor 门禁不会被 parser 的「全班」回落掩盖', () => {
  const course = fakeCourse({
    phasesMarkdown: `## Phase 1：导入

### 阶段任务1：测试
- 执行单位：全组
`,
    phases: [{
      id: 'phase-1',
      name: '导入',
      tasks: [{ id: 'phase-1-task-1', name: '测试', executor: '全班', steps: [], acceptance: '完成' }],
    }],
  });
  const { issues, stats } = lintCourse(course, { lessonsRoot, courseId: course.id });
  const hit = issues.filter((issue) => issue.code === 'bad_executor');
  assert.equal(hit.length, 1);
  assert.equal(hit[0].level, 'error');
  assert.equal(hit[0].line, 4);
  assert.equal(stats.badExecutors, 1);
  assert.equal(exitCodeForIssues(hit), 1);
});

test('迁移后的 gewu 语义质量审计为 0 个 error', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const { issues } = auditCourseQuality(course);
  const errors = issues.filter((issue) => issue.level === 'error');
  assert.deepEqual(errors, []);
  assert.equal(issues.filter((issue) => issue.code === 'protected_scaffold_leak').length, 0);
  assert.equal(issues.filter((issue) => issue.code === 'stale_phase_capability').length, 0);
  assert.equal(issues.filter((issue) => issue.code === 'timing_conflict').length, 0);
});
