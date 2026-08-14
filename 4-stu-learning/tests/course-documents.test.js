import test from 'node:test';
import assert from 'node:assert/strict';
import { materializeCourseDocuments } from '../src/engine/course-documents.js';
import { parseLesson } from '../src/engine/lesson-parser.js';
import { resolveStepRestrictions } from '../server/course/restriction-sections.js';
import { toPublic } from '../server/course/projections.js';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { fileURLToPath } from 'node:url';

const LESSONS_ROOT = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

const COURSE_SHELL = [
  '# 内嵌文档测试课',
  '',
  '## 基本信息',
  '- 主题模板：gewu',
  '',
  '## 学生端角色体系',
  '- collectionName：测试角色',
  '- itemName：身份',
  '- collectionItemName：密符',
  '- collectionPanelName：小组密符',
  '- unlockTarget：合流',
  '- 任务阶段：phase-2',
].join('\n');

const EMBEDDED_COURSE = [
  COURSE_SHELL,
  '',
  '## 课程目标体系',
  '',
  '### 学科知识 DK',
  '- DK-01 现场证据：用可核验的观察支撑结论',
  '- DK-02 系统关联：连接局部现象与整体系统',
  '',
  '### 课程能力 DC',
  '- DC-01 证据意识：区分观察、引用与推测',
  '',
  '## 阶段编排',
  '',
  '### Phase 2：现场探究',
  '- 时长：30min',
  '- 模式：个人',
  '- 地点：现场',
  '',
  '#### 阶段任务1：核验螭首数量',
  '- id：phase-2-task-1',
  '- 执行单位：个人',
  '- 完成方式：user_confirm',
  '- 通过条件：完成一次现场核验',
  '- 证据要求：提交计数记录',
  '',
  '##### Step 1：提交计数记录',
  '- id：count-step',
  '- 小步目标：核验螭首数量',
  '- 学生行动：先记录观察，不要直接采信 1142',
  '- 位置：none',
  '- 完成方式：user_confirm',
  '- 证据要求：一条可核验记录',
  '- 限制引用：course.md#课程限制规则/螭首总数',
  '',
  '###### 验收标准',
  '记录中同时包含计数方法和现场依据。',
  '',
  '## 课程限制规则',
  '',
  '> 以下精确答案只能在解除条件满足后透露。',
  '',
  '### 核心数据限制',
  '',
  '| 限制项 | 不可透露的内容 | 保护原因 | 解除条件 |',
  '|---|---|---|---|',
  '| 螭首总数 | 1142这个精确数字 | 学生需要自己核验 | 完成计数任务后 |',
  '| 台基坡度 | 2%这个精确数字 | 学生需要自己测量 | 完成测量任务后 |',
].join('\n');

function embeddedFiles() {
  return {
    'course.md': EMBEDDED_COURSE,
  };
}

test('course.md 内嵌命名空间物化为三份逻辑文档，内部标题提升一级', () => {
  const input = embeddedFiles();
  const files = materializeCourseDocuments(input);

  assert.notStrictEqual(files, input, '物化不应原地改写课程源文件表');
  assert.equal(input['phases.md'], undefined);

  assert.match(files['objectives.md'], /^# 课程目标体系$/m);
  assert.match(files['objectives.md'], /^## 学科知识 DK$/m);
  assert.match(files['objectives.md'], /^- DK-01 现场证据：用可核验的观察支撑结论$/m);
  assert.doesNotMatch(files['objectives.md'], /Phase 2|核心数据限制/);

  assert.match(files['phases.md'], /^# 阶段编排$/m);
  assert.match(files['phases.md'], /^## Phase 2：现场探究$/m);
  assert.match(files['phases.md'], /^### 阶段任务1：核验螭首数量$/m);
  assert.match(files['phases.md'], /^#### Step 1：提交计数记录$/m);
  assert.match(files['phases.md'], /^##### 验收标准$/m);
  assert.doesNotMatch(files['phases.md'], /核心数据限制|1142这个精确数字/);

  assert.match(files['restrictions.md'], /^# 课程限制规则$/m);
  assert.match(files['restrictions.md'], /^## 核心数据限制$/m);
  assert.match(files['restrictions.md'], /^\| 螭首总数 \| 1142这个精确数字 \|/m);
});

test('只把三个精确二级标题识别为内嵌文档容器', () => {
  const files = materializeCourseDocuments({
    'course.md': [
      COURSE_SHELL,
      '',
      '## 教研备注',
      '### 阶段编排',
      '这只是备注里的同名三级标题。',
      '### 课程限制规则',
      '这也不是课程限制容器。',
    ].join('\n'),
  });

  assert.equal(files['objectives.md'], '');
  assert.equal(files['phases.md'], '');
  assert.equal(files['restrictions.md'], '');
});

test('内嵌阶段的 Phase / 阶段任务 / Step 与就地验收标准进入解析层', () => {
  const files = materializeCourseDocuments(embeddedFiles());
  const lesson = parseLesson({ id: 'embedded-test', assetBase: 'assets', files });
  const phase = lesson.phases[0];
  const task = phase.tasks[0];
  const step = task.steps[0];

  assert.equal(lesson.subtitle, '', '限制规则里的引用说明不能被误读为课程副标题');
  assert.equal(phase.id, 'phase-2');
  assert.equal(phase.name, '现场探究');
  assert.equal(task.id, 'phase-2-task-1');
  assert.equal(task.name, '核验螭首数量');
  assert.equal(task.executor, '个人');
  assert.equal(step.id, 'count-step');
  assert.equal(step.studentAction, '先记录观察，不要直接采信 1142');
  assert.match(step.acceptance, /计数方法和现场依据/);
});

test('course.md 新引用能精确解析限制表某一行，公开投影仍使用同一份逻辑限制脱敏', () => {
  const files = materializeCourseDocuments(embeddedFiles());
  const lesson = parseLesson({ id: 'embedded-test', assetBase: 'assets', files });
  const step = lesson.phases[0].tasks[0].steps[0];
  const resolved = resolveStepRestrictions({ restrictionMarkdown: files['restrictions.md'] }, step);

  assert.deepEqual(resolved.map((item) => item.title), ['螭首总数']);
  assert.match(resolved[0].text, /1142/);
  assert.doesNotMatch(resolved[0].text, /2%/);

  const publicLesson = toPublic(lesson, files['restrictions.md']);
  assert.doesNotMatch(JSON.stringify(publicLesson), /1142/);
  assert.match(publicLesson.phases[0].tasks[0].steps[0].studentAction, /\[待学生探索\]/);
});

test('旧课程的三份外置文档保持兼容', () => {
  const input = {
    'course.md': COURSE_SHELL,
    'objectives.md': '# 课程目标体系\n\n## 学科知识 DK\n- DK-09 旧课目标',
    'phases.md': '# 阶段编排\n\n## Phase 2：旧课现场\n- 时长：20min',
    'restrictions.md': '# 课程限制规则\n\n## 旧课限制\n- 不提前透露结论',
  };
  const files = materializeCourseDocuments(input);

  assert.deepEqual(files, input);
  assert.notStrictEqual(files, input);
});

test('同一逻辑文档同时内嵌与外置时明确拒绝双源', () => {
  const cases = [
    ['课程目标体系', 'objectives.md'],
    ['阶段编排', 'phases.md'],
    ['课程限制规则', 'restrictions.md'],
  ];

  for (const [section, filename] of cases) {
    const files = {
      'course.md': `${COURSE_SHELL}\n\n## ${section}\n\n### 占位子节\n内嵌内容`,
      [filename]: `# ${section}\n\n外置内容`,
    };
    assert.throws(
      () => materializeCourseDocuments(files),
      (error) => {
        assert.match(String(error?.message || error), /duplicate|重复来源|双源|同时.*(?:内嵌|外置)|(?:内嵌|外置).*同时/iu);
        assert.match(String(error?.message || error), new RegExp(filename.replace('.', '\\.')));
        return true;
      },
    );
  }
});

test('同一结构化命名空间重复出现时明确拒绝，不能静默丢掉后一个', () => {
  for (const section of ['课程目标体系', '阶段编排', '课程限制规则']) {
    assert.throws(
      () => materializeCourseDocuments({
        'course.md': [
          COURSE_SHELL,
          '',
          `## ${section}`,
          '### 第一份',
          '第一份内容',
          '',
          `## ${section}`,
          '### 第二份',
          '第二份内容',
        ].join('\n'),
      }),
      (error) => {
        assert.match(String(error?.message || error), /命名空间重复/u);
        assert.match(String(error?.message || error), new RegExp(section, 'u'));
        return true;
      },
    );
  }
});

test('六门真课程都以内嵌三命名空间作为唯一课程数据源', async () => {
  const courseIds = [
    'lesson_gewu_001',
    'lesson_youyi_001',
    'lesson_zhizhi_001',
    'lesson_zhizhi_002',
    'lesson_zhizhi_003',
    'lesson_zhuhun_001',
  ];
  for (const courseId of courseIds) {
    clearCourseCache();
    const course = await compileCourse({ lessonsRoot: LESSONS_ROOT, courseId });
    assert.deepEqual(
      Object.fromEntries(Object.entries(course.documentSources).map(([name, source]) => [
        name,
        { sourceFile: source.sourceFile, embedded: source.embedded },
      ])),
      {
        'objectives.md': { sourceFile: 'course.md', embedded: true },
        'phases.md': { sourceFile: 'course.md', embedded: true },
        'restrictions.md': { sourceFile: 'course.md', embedded: true },
      },
      `${courseId} 不应继续维护外置目标、阶段或限制双源`,
    );
    // 五门正式课都是 6 个 Phase；游艺课是单阶段工具测试课。
    const expectedPhases = courseId === 'lesson_youyi_001' ? 1 : 6;
    assert.equal(course.lesson.phases.length, expectedPhases, `${courseId} Phase 数不符合课程定位`);
    assert.equal(course.sourceFiles['README.md'], undefined);
    assert.equal(course.sourceFiles['assets-checklist.md'], undefined);
  }
});
