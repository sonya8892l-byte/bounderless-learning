import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { compileCourse } from '../server/course/compiler.js';
import { findSpoiler } from '../server/course/retrieval.js';
import { createStudentFacingPolicy } from '../server/agent/student-facing-policy.js';
import {
  restrictionProtectedMatchers,
  restrictionProtectedTerms,
  matchesProtectedMatchers,
} from '../server/course/projections.js';
import {
  protectedMatchersFromRestrictions,
  hasProtectionLeak,
} from '../scripts/ai-dialogue-evaluator.mjs';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

function lockedSession(overrides = {}) {
  return {
    phaseNumber: 2,
    completedTaskIds: [],
    events: [],
    ...overrides,
  };
}

test('编译后的答案门禁识别中文数字和功能同义改写', async () => {
  const course = await compileCourse({
    lessonsRoot: path.resolve(lessonsRoot),
    courseId: 'lesson_gewu_001',
  });
  const session = lockedSession();

  assert.equal(findSpoiler('精确结果是一千一百四十二只。', course, session)?.restriction.name, '螭首总数');
  assert.equal(
    findSpoiler('螭首承担把雨水导出屋面的功能。', course, session)?.restriction.name,
    '螭首工程功能',
  );
  assert.equal(findSpoiler('请观察螭首与台基的位置关系。', course, session), null);
  assert.equal(findSpoiler('先记录雨水流动的方向。', course, session), null);

  const surface = createStudentFacingPolicy({ course, session }).processSurface({
    instructions: '请在卡片里填入一千一百四十二只。',
    hint: '螭首承担把雨水导出屋面的功能。',
  }, { channel: 'tool' });
  assert.equal(JSON.stringify(surface.value).includes('一千一百四十二'), false);
  assert.equal(JSON.stringify(surface.value).includes('雨水导出屋面'), false);
  assert.ok(surface.actions.some((action) => action.includes('protected_answer_blocked')));
});

test('运行时与评测器共用同一组 canonical matcher', async () => {
  const course = await compileCourse({
    lessonsRoot: path.resolve(lessonsRoot),
    courseId: 'lesson_gewu_001',
  });
  const matchers = protectedMatchersFromRestrictions(course.restrictions);
  assert.ok(matchers.length > 0);
  assert.equal(hasProtectionLeak('数出一千一百四十二只。', false, [], matchers), true);
  assert.equal(hasProtectionLeak('螭首承担把雨水导出屋面的功能。', false, [], matchers), true);
  assert.equal(hasProtectionLeak('先记录你看到的现象。', false, [], matchers), false);
});

test('数值门禁归一化中文数字、万位和立方米单位', () => {
  const matchers = restrictionProtectedMatchers('蓄水量', '60万m³');
  assert.equal(matchesProtectedMatchers('蓄水量约为六十万立方米。', matchers), true);

  const percent = restrictionProtectedMatchers('坡度', '2%');
  assert.equal(matchesProtectedMatchers('这里的坡度是百分之二。', percent), true);
});

test('过短通用判断词不单独编译为全局剧透词', () => {
  const terms = restrictionProtectedTerms('措施成效', '某项措施“有效”或“无效”的结论');
  assert.deepEqual(terms, []);
  const matchers = restrictionProtectedMatchers('措施成效', '某项措施“有效”或“无效”的结论');
  assert.equal(matchesProtectedMatchers('这条证据有效吗？', matchers), false);
});
