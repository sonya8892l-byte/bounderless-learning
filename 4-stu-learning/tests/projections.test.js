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

test('toPublic 产物里没有课程答案：1142 一次都不出现', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });

  // 全量结构里确实有这个答案，正是它今天没漏出去全靠"没人整体序列化"的那一个。
  assert.ok(JSON.stringify(course.lesson).includes('1142'), '前提：全量产物含该答案');

  const serialized = JSON.stringify(toPublic(course.lesson, course.restrictionMarkdown));
  assert.equal(serialized.includes('1142'), false, '公开投影绝不能含答案');
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
