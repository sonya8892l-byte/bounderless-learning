import assert from 'node:assert/strict';
import test from 'node:test';

import { entryPhaseForLesson } from '../src/engine/entry-phase.js';
import { getLesson } from '../src/services/course-service.js';

test('角色阶段本身的无角色入口任务会先于角色选择执行', () => {
  const lesson = {
    roleSystem: { phaseId: 'phase-1' },
    phases: [
      { id: 'phase-1', tasks: [{ id: 'opening-boundary-card' }] },
      { id: 'phase-2', tasks: [] },
    ],
  };
  assert.equal(entryPhaseForLesson(lesson)?.id, 'phase-1');
});

test('若角色阶段前已有入口任务，使用最早的可执行阶段', () => {
  const lesson = {
    roleSystem: { phaseId: 'phase-3' },
    phases: [
      { id: 'phase-1', tasks: [] },
      { id: 'phase-2', tasks: [{ id: 'shared-opening' }] },
      { id: 'phase-3', tasks: [{ id: 'same-phase-opening' }] },
    ],
  };
  assert.equal(entryPhaseForLesson(lesson)?.id, 'phase-2');
});

test('知之三课程的研究开题边界卡在学生端可达', () => {
  const lesson = getLesson('lesson_zhizhi_003');
  const entry = entryPhaseForLesson(lesson);
  assert.ok(entry, '知之三应有进入角色前的可执行任务');
  assert.equal(entry.id, lesson.roleSystem.phaseId);
  assert.equal(entry.tasks.length, 1);
});
