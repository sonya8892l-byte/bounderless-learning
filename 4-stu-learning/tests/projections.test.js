import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { compileCourse, clearCourseCache } from '../server/course/compiler.js';
import { toPublic } from '../server/course/projections.js';

const lessonsRoot = resolve(import.meta.dirname, '../../6-lessons');
const PRIVATE_TASK_FIELDS = ['guide', 'toolParameters', 'inlineGuidance', 'inlineScaffold', 'inlineAcceptance', 'competencyTags'];

test('服务端的 course.lesson 是全量结构：时间银行判分依赖这些私有字段', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });

  // 反向断言。若哪天有人"顺手"把 lesson 改成公开投影，answerTimeBank 会静默算错，
  // 这条会先红：service.js 的 answerTimeBank 读的就是 task.answer / verify / radius。
  const bankTask = course.lesson.timeBank.tasks[0];
  assert.ok(Object.hasOwn(bankTask, 'answer'), '时间银行答案必须留在服务端');
  assert.ok(Object.hasOwn(bankTask, 'verify'), '时间银行校验方式必须留在服务端');

  const task = course.lesson.roles[0].tasks[0];
  assert.ok(Object.hasOwn(task, 'inlineAcceptance'), '就地验收标准必须留在服务端');
  assert.ok(Object.hasOwn(task, 'competencyTags'), '能力标签必须留在服务端（预留数据，不下发）');
  assert.ok(Object.hasOwn(course.lesson.roles[0], 'keyData'), 'keyData 必须留在服务端');
});

test('toPublic 裁掉全部私有字段，且不改动入参', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const before = JSON.stringify(course.lesson);

  const publicLesson = toPublic(course.lesson, course.restrictionMarkdown);

  assert.equal(JSON.stringify(course.lesson), before, 'toPublic 必须是纯函数，不能改动全量产物');

  for (const role of publicLesson.roles) {
    assert.equal(Object.hasOwn(role, 'keyData'), false);
    for (const task of role.tasks) {
      for (const key of PRIVATE_TASK_FIELDS) {
        assert.equal(Object.hasOwn(task, key), false, `公开投影不该含 ${key}`);
      }
    }
  }
  for (const bankTask of publicLesson.timeBank.tasks) {
    for (const key of ['answer', 'verify', 'radius', 'location']) {
      assert.equal(Object.hasOwn(bankTask, key), false, `公开投影不该含时间银行的 ${key}`);
    }
  }
});

test('toPublic 产物里没有课程限制规则保存的答案：1142 一次都不出现', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });

  // 答案保存在服务端私有的课程限制命名空间，公开投影只接收脱敏规则，不下发原文。
  assert.ok(course.restrictionMarkdown.includes('1142'), '前提：私有课程限制规则含该答案');

  const serialized = JSON.stringify(toPublic(course.lesson, course.restrictionMarkdown));
  assert.equal(serialized.includes('1142'), false, '公开投影绝不能含答案');
});

test('toPublic 也会清理受保护结论的高置信等价改写', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const lesson = structuredClone(course.lesson);
  lesson.roles[0].tasks[0].requirement = '螭首承担把雨水导出屋面的功能。';

  const publicLesson = toPublic(lesson, course.restrictionMarkdown);
  assert.equal(publicLesson.roles[0].tasks[0].requirement, '[待学生探索]');
});

test('正式课程的公开文案不依赖脱敏占位符补句子', async () => {
  for (const courseId of [
    'lesson_gewu_001',
    'lesson_zhizhi_001',
    'lesson_zhizhi_002',
    'lesson_zhizhi_003',
    'lesson_zhuhun_001',
  ]) {
    clearCourseCache();
    const course = await compileCourse({ lessonsRoot, courseId });
    const serialized = JSON.stringify(toPublic(course.lesson, course.restrictionMarkdown));
    assert.equal(
      serialized.includes('[待学生探索]'),
      false,
      `${courseId}：应把源文案改成可读的探索问题，不能让学生看到拼接占位符`,
    );
  }
});

test('构建脚本与服务端共用同一个 toPublic：产物逐字段相同', async () => {
  const { default: publicLessons } = await import('../src/generated/lesson-public.js');
  clearCourseCache();

  for (const courseId of Object.keys(publicLessons)) {
    const course = await compileCourse({ lessonsRoot, courseId });
    assert.deepEqual(
      toPublic(course.lesson, course.restrictionMarkdown),
      publicLessons[courseId],
      `${courseId}：运行期投影必须与构建期产物一致，否则"双清单"又回来了`,
    );
  }
});
