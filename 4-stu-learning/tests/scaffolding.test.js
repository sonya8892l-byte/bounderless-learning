import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { SCAFFOLDING_DEFAULTS, resolveScaffolding } from '../server/course/platform-defaults.js';
import { taskScaffoldHint } from '../server/agent/prompt.js';
import { decideTutorAction } from '../server/agent/tutor-policy.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

test('scaffolding.md 的 L0–L4 语义与升档参数与代码回落一致', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  assert.deepEqual(course.platformDefaults.scaffolding, {
    maxLevel: 4,
    upgradeOnRepeatHelp: true,
    fallbackHint: SCAFFOLDING_DEFAULTS.fallbackHint,
    levels: SCAFFOLDING_DEFAULTS.levels,
  });
});

test('缺省提示来自 scaffolding；课程脚手架表有内容时仍优先读表', () => {
  const scaffolding = resolveScaffolding(null).scaffolding;
  const task = {
    scaffold: '| 等级 | 提示 |\n| L1 | “先看嘴巴形状” |\n',
    guidanceSteps: ['拍一张全景'],
  };
  assert.equal(taskScaffoldHint(task, 0, 0, null, scaffolding), '先看嘴巴形状。');
  assert.equal(
    taskScaffoldHint({ guidanceSteps: [] }, 0, 0, null, scaffolding),
    scaffolding.fallbackHint,
  );
});

test('脚手架列表写法与表格写法同样可按档读取，缺档仍向下回退', () => {
  const scaffolding = resolveScaffolding(null).scaffolding;
  const task = {
    scaffold: '- L1：先找一个固定参照\n- L3: 比较两个位置的同一特征',
    guidanceSteps: [],
  };
  assert.equal(taskScaffoldHint(task, 0, 0, null, scaffolding), '先找一个固定参照。');
  assert.equal(taskScaffoldHint(task, 2, 0, null, scaffolding), '比较两个位置的同一特征。');
  assert.equal(taskScaffoldHint(task, 1, 0, null, scaffolding), '先找一个固定参照。');
});

test('升档参数关闭后，同类求助第二次不再升档', () => {
  const understanding = { intent: 'help_stuck', emotion: 'neutral', confidence: 0.9 };
  const recent = [{ action: 'give_scaffold', intent: 'help_stuck' }];
  const upgraded = decideTutorAction(understanding, {
    scaffoldLevel: 1,
    recentActions: recent,
    maxScaffoldLevel: 4,
    upgradeOnRepeatHelp: true,
  });
  assert.equal(upgraded.params.scaffoldLevelDelta, 1);

  const frozen = decideTutorAction(understanding, {
    scaffoldLevel: 1,
    recentActions: recent,
    maxScaffoldLevel: 4,
    upgradeOnRepeatHelp: false,
  });
  assert.equal(frozen.params.scaffoldLevelDelta, undefined);
});
