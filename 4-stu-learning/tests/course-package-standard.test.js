import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileCourse, clearCourseCache } from '../server/course/compiler.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));
const courseIds = Object.freeze([
  'lesson_gewu_001',
  'lesson_zhizhi_001',
  'lesson_zhizhi_002',
  'lesson_zhizhi_003',
  'lesson_zhuhun_001',
]);

const courseNamespaces = Object.freeze(['课程目标体系', '阶段编排', '课程限制规则']);
const phasePromptSections = Object.freeze(['阶段目标', '絮絮行为', '开场白模板', '禁止行为', '转场条件']);

function h2Titles(markdown = '') {
  return [...String(markdown).matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1]);
}

function phaseBlocks(markdown = '') {
  const matches = [...String(markdown).matchAll(/^###\s+Phase\s+\d+[：:].+$/gm)];
  return matches.map((match, index) => (
    markdown.slice(match.index, matches[index + 1]?.index ?? markdown.length)
  ));
}

async function assertMissing(file) {
  await assert.rejects(access(file));
}

test('五门课程统一使用 course.md 三大命名空间与五段 Phase Prompt', async () => {
  for (const courseId of courseIds) {
    const root = path.join(lessonsRoot, courseId);
    const courseMarkdown = await readFile(path.join(root, 'course.md'), 'utf8');
    const headings = h2Titles(courseMarkdown);

    for (const namespace of courseNamespaces) {
      assert.equal(
        headings.filter((heading) => heading === namespace).length,
        1,
        `${courseId} 的 course.md 必须且只能有一个「${namespace}」`,
      );
    }

    await Promise.all([
      assertMissing(path.join(root, 'objectives.md')),
      assertMissing(path.join(root, 'phases.md')),
      assertMissing(path.join(root, 'restrictions.md')),
    ]);

    const promptFiles = await readdir(path.join(root, 'prompts'));
    for (const name of promptFiles.filter((entry) => entry.endsWith('.md'))) {
      const markdown = await readFile(path.join(root, 'prompts', name), 'utf8');
      assert.deepEqual(
        h2Titles(markdown),
        phasePromptSections,
        `${courseId}/prompts/${name} 只能包含五个标准二级标题`,
      );
    }
  }
});

test('课程源不再提交没有运行消费者的字段和空位置占位', async () => {
  const forbiddenCourseField = /^-\s*(?:对话背景|阶段转场|完课证书|推演占位图)[：:]/m;
  const forbiddenRoleField = /^(?:>\s*核心问题[：:]|-\s*(?:类型|阶段)[：:]|-\s*(?:地点|坐标|围栏半径)[：:]\s*$)/m;

  for (const courseId of courseIds) {
    const root = path.join(lessonsRoot, courseId);
    const courseMarkdown = await readFile(path.join(root, 'course.md'), 'utf8');
    assert.doesNotMatch(courseMarkdown, forbiddenCourseField, `${courseId}/course.md 仍有冗余字段`);

    for (const block of phaseBlocks(courseMarkdown)) {
      const phaseFields = block.split(/^####\s+/m)[0];
      assert.doesNotMatch(
        phaseFields,
        /^-\s*(?:功能模块|触发条件|结束条件)[：:]/m,
        `${courseId} 的 Phase 顶层仍有未接入流程的说明字段`,
      );
    }

    const course = await compileCourse({ lessonsRoot, courseId });
    for (const role of course.roles) {
      assert.doesNotMatch(
        course.sourceFiles[`roles/${role.id}.md`] || '',
        forbiddenRoleField,
        `${courseId}/roles/${role.id}.md 仍有冗余字段或空位置占位`,
      );
    }
    clearCourseCache();
  }
});

test('五门课程的目标、角色、Task、Step、知识、限制与验收均可编译', async () => {
  for (const courseId of courseIds) {
    clearCourseCache();
    const course = await compileCourse({ lessonsRoot, courseId });
    const tasks = course.roles.flatMap((role) => role.tasks);
    const steps = tasks.flatMap((task) => task.steps);

    assert.ok(course.objectives.length > 0, `${courseId} 没有解析出课程目标`);
    assert.equal(course.lesson.phases.length, 6, `${courseId} 应有 6 个 Phase`);
    assert.equal(Object.keys(course.phasePolicies).length, 6, `${courseId} 应有 6 份 Phase policy`);
    assert.ok(course.roles.length > 0, `${courseId} 没有角色`);
    assert.ok(tasks.length > 0, `${courseId} 没有角色 Task`);
    assert.ok(steps.length > 0, `${courseId} 没有显式 Step`);
    assert.ok(course.knowledge.length > 0, `${courseId} 没有知识条目`);
    assert.ok(course.restrictionDocument.rows.length > 0, `${courseId} 没有限制规则`);

    for (const task of tasks) {
      assert.ok(task.steps.length > 0, `${courseId}/${task.id} 没有显式 Step`);
      assert.ok(task.guidance, `${courseId}/${task.id} 没有就地引导`);
      assert.ok(task.scaffold, `${courseId}/${task.id} 没有就地脚手架`);
    }

    for (const step of steps) {
      assert.ok(step.acceptance, `${courseId}/${step.id} 没有就地验收标准`);
      assert.ok(step.knowledgeRef, `${courseId}/${step.id} 没有知识引用`);
      assert.ok(step.restrictionRef, `${courseId}/${step.id} 没有限制引用`);
    }
  }
  clearCourseCache();
});
