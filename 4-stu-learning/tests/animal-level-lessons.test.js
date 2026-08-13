import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileCourse, clearCourseCache } from '../server/course/compiler.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));
const cases = [
  {
    id: 'lesson_zhizhi_001',
    level: '大众体验版',
    levelCode: 'experience',
    knowledgeMinimum: 20,
  },
  {
    id: 'lesson_zhizhi_002',
    level: '深度探究版',
    levelCode: 'inquiry',
    knowledgeMinimum: 18,
  },
  {
    id: 'lesson_zhizhi_003',
    level: '研究性学习版',
    levelCode: 'research',
    knowledgeMinimum: 22,
  },
];

function duplicates(values) {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

function markdownAssetReferences(files) {
  return [...new Set(
    Object.values(files)
      .flatMap((markdown) => [...markdown.matchAll(/assets\/[A-Za-z0-9_./-]+\.(?:svg|png|jpe?g|webp|mp3|mp4)/g)])
      .map((match) => match[0]),
  )];
}

function referencedKnowledgeIds(files) {
  return [...new Set(
    Object.values(files)
      .flatMap((markdown) => [...markdown.matchAll(/\bK-\d+\b/g)])
      .map((match) => match[0]),
  )];
}

function assertDocumentReference(course, reference, field) {
  for (const raw of String(reference || '').split(/[,，]/).map((value) => value.trim()).filter(Boolean)) {
    const canonicalRestriction = raw.match(/^course\.md#课程限制规则\/(.+)$/);
    const match = raw.match(/^((?:guidance|scaffolds)\/[^#]+\.md|restrictions\.md|evaluation\.md)#(.+)$/);
    const filename = canonicalRestriction ? 'restrictions.md' : match?.[1];
    const anchor = canonicalRestriction?.[1] || match?.[2];
    assert.ok(canonicalRestriction || match, `${course.id} 的 ${field} 引用格式无效：${raw}`);
    const markdown = course.files[filename];
    assert.ok(markdown, `${course.id} 缺少引用文件 ${filename}`);
    const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(
      markdown,
      new RegExp(`^(?:#{2,4}\\s+|-\\s+|\\|\\s*)${escaped}(?:\\s|$|[：:|])`, 'm'),
      `${raw} 没有对应标题、量规或限制项`,
    );
  }
}

function assertRoleStateFlow(course, role) {
  role.tasks.forEach((task, taskIndex) => {
    task.steps.forEach((step, stepIndex) => {
      const isLastStep = stepIndex === task.steps.length - 1;
      const isLastTask = taskIndex === role.tasks.length - 1;
      const expected = !isLastStep
        ? `step:${task.steps[stepIndex + 1].id}`
        : isLastTask
          ? 'role:complete'
          : `role-stage:${role.tasks[taskIndex + 1].id}`;
      assert.equal(step.next, expected, `${course.id}/${role.id}/${step.id} 的跳转目标无效`);
    });
  });
}

for (const config of cases) {
  test(`${config.id} 可编译并满足三层级课程结构契约`, async () => {
    clearCourseCache();
    const course = await compileCourse({ lessonsRoot, courseId: config.id });
    const lesson = course.lesson;

    assert.equal(lesson.series, '致知');
    assert.equal(lesson.seriesCode, 'zhizhi');
    assert.equal(lesson.themeTemplate, 'zhizhi');
    assert.equal(lesson.level, config.level);
    assert.equal(lesson.levelCode, config.levelCode);
    assert.equal(lesson.timeBank.enabled, true);
    assert.equal(lesson.timeBank.tasks.length, 6);
    assert.deepEqual(
      duplicates(lesson.timeBank.tasks.map((task) => task.id)),
      [],
      `${course.id} 的时间银行任务ID应唯一`,
    );
    assert.ok(lesson.timeBank.earnRules.maxTotal > 0);
    assert.ok(lesson.timeBank.earnRules.maxPerTask > 0);
    assert.ok(lesson.timeBank.earnRules.tasksVisibleAtOnce > 0);
    for (const task of lesson.timeBank.tasks) {
      assert.match(task.unlockAfter, /^phase[1-6]-start$/, `${course.id}/${task.id} 的解锁阶段无效`);
      assert.ok(task.reward <= lesson.timeBank.earnRules.maxPerTask, `${course.id}/${task.id} 奖励超过单题上限`);
    }
    assert.equal(lesson.roles.length, 6);
    assert.equal(lesson.phases.length, 6);
    assert.equal(Object.keys(course.phasePrompts).length, 6);
    assert.ok(course.knowledge.length >= config.knowledgeMinimum);

    const roleIds = course.roles.map((role) => role.id);
    const taskIds = course.roles.flatMap((role) => role.tasks.map((task) => task.id));
    const steps = course.roles.flatMap((role) => role.tasks.flatMap((task) => task.steps));
    const stepIds = steps.map((step) => step.id);
    assert.deepEqual(duplicates(roleIds), [], '角色ID应在课程内唯一');
    assert.deepEqual(duplicates(taskIds), [], '任务ID应在课程内唯一');
    assert.deepEqual(duplicates(stepIds), [], 'Step ID应在课程内唯一');

    for (const role of course.roles) {
      assert.equal(role.tasks.length, 3, `${role.id} 应有3个角色阶段`);
      // v2 起引导与脚手架就地写在 roles/<role>.md 内，不再有独立目录；
      // 装配结果按任务逐一断言（见下方 task.guidance / task.scaffold）。
      assertRoleStateFlow(course, role);
      for (const task of role.tasks) {
        assert.ok(task.steps.length >= 2 && task.steps.length <= 4, `${role.id}/${task.id} 应有2—4个Step`);
        assert.ok(task.guidance, `${role.id}/${task.id} 的引导未装配`);
        assert.ok(task.scaffold, `${role.id}/${task.id} 的脚手架未装配`);
        for (const step of task.steps) {
          assert.ok(step.studentAction, `${step.id} 缺少学生行动`);
          assert.ok(step.evidenceRequirement, `${step.id} 缺少证据要求`);
          assert.ok(step.tools.length > 0 || step.location.mode !== 'none' || step.teacherIntervention, `${step.id} 缺少验收条件`);
          assert.ok(step.failureHandling, `${step.id} 缺少失败恢复`);
          assert.ok(step.teacherIntervention, `${step.id} 缺少教师介入规则`);
          assertDocumentReference(course, step.guidanceRef, '引导');
          assertDocumentReference(course, step.scaffoldRef, '脚手架');
          assertDocumentReference(course, step.restrictionRef, '限制');
          assertDocumentReference(course, step.evaluationRef, '评估');
        }
      }
    }

    const knowledgeIds = new Set(course.knowledge.map((entry) => entry.id));
    assert.deepEqual(duplicates([...knowledgeIds]), []);
    for (const id of referencedKnowledgeIds(course.files)) {
      assert.ok(knowledgeIds.has(id), `${config.id} 引用了不存在的知识卡 ${id}`);
    }
    for (const entry of course.knowledge) {
      assert.ok(entry.content, `${entry.id} 缺少content`);
      assert.ok(entry.source, `${entry.id} 缺少source`);
      assert.ok(entry.roles.length, `${entry.id} 缺少roles`);
      assert.ok(entry.revealWhen, `${entry.id} 缺少revealTiming`);
    }

    for (const [filename, markdown] of Object.entries(course.files)) {
      for (const line of markdown.split('\n').filter((value) => value.startsWith('- 工具参数：'))) {
        const json = line.slice('- 工具参数：'.length);
        assert.doesNotThrow(() => JSON.parse(json), `${config.id}/${filename} 工具参数必须是单行合法JSON`);
      }
    }

    for (const asset of markdownAssetReferences(course.files)) {
      await fs.access(path.join(lessonsRoot, config.id, asset));
    }

    const publicConfig = JSON.stringify(course.roles.flatMap((role) => role.tools).map((tool) => tool.publicConfig));
    for (const privateKey of ['"answer":', '"answers":', '"expectedResults":', '"correctMapping":', '"validConnections":', '"evaluationPrompt":']) {
      assert.equal(publicConfig.includes(privateKey), false, `${config.id} 公开对象包含私有字段 ${privateKey}`);
    }
  });
}

test('旧课程默认层级为空，新课程入口代码按需展示层级标签', async () => {
  clearCourseCache();
  const legacy = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  assert.equal(legacy.lesson.level, '');
  assert.equal(legacy.lesson.levelCode, '');

  const appController = await fs.readFile(new URL('../src/app-controller.js', import.meta.url), 'utf8');
  assert.match(appController, /lesson\.level\s*\?/);
  assert.match(appController, /layers-3/);
});

test('三套课程全局ID唯一，并各模拟一名学生完成角色状态流', async () => {
  const allRoleIds = [];
  const allTaskIds = [];
  const allStepIds = [];

  for (const config of cases) {
    const course = await compileCourse({ lessonsRoot, courseId: config.id });
    allRoleIds.push(...course.roles.map((role) => role.id));
    allTaskIds.push(...course.roles.flatMap((role) => role.tasks.map((task) => task.id)));
    allStepIds.push(...course.roles.flatMap((role) => role.tasks.flatMap((task) => task.steps.map((step) => step.id))));

    const role = course.roles[0];
    const simulated = {
      roleId: role.id,
      completedRoleStageIds: [],
      completedStepIds: [],
      status: 'active',
    };
    for (const task of role.tasks) {
      for (const step of task.steps) simulated.completedStepIds.push(step.id);
      simulated.completedRoleStageIds.push(task.id);
    }
    simulated.status = role.tasks.at(-1).steps.at(-1).next === 'role:complete' ? 'complete' : 'blocked';

    assert.equal(simulated.status, 'complete');
    assert.equal(simulated.completedRoleStageIds.length, 3);
    assert.equal(simulated.completedStepIds.length, 6);
  }

  assert.deepEqual(duplicates(allRoleIds), []);
  assert.deepEqual(duplicates(allTaskIds), []);
  assert.deepEqual(duplicates(allStepIds), []);
});

test('动态法律、保护状态和馆内点位保留日期与人工复核提示', async () => {
  const inquiry = await compileCourse({ lessonsRoot, courseId: 'lesson_zhizhi_002' });
  const research = await compileCourse({ lessonsRoot, courseId: 'lesson_zhizhi_003' });
  const inquirySources = inquiry.knowledge.filter((entry) => ['K-02', 'K-03', 'K-18'].includes(entry.id)).map((entry) => entry.source).join('\n');
  assert.match(inquirySources, /访问日期?2026-07-31|访问2026-07-31/);
  assert.match(inquirySources, /人工复核|踏勘/);

  const legalCards = research.knowledge.filter((entry) => ['K-08', 'K-09', 'K-10'].includes(entry.id));
  assert.equal(legalCards.length, 3);
  assert.match(legalCards.map((entry) => `${entry.content}\n${entry.source}`).join('\n'), /2026年8月15日/);
  assert.equal(legalCards.every((entry) => /访问2026-07-31|访问日期2026-07-31/.test(entry.source)), true);
  assert.equal(legalCards.every((entry) => /人工复核|实施前人工复核|原文实施前人工复核/.test(entry.source)), true);
});
