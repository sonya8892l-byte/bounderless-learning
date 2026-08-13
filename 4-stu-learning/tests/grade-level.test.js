import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  canonicalGradeLevel,
  DEFAULT_GRADE_LEVEL,
  GRADE_LEVELS,
  isGradeLevel,
  resolveGradeLevel,
} from '../src/engine/grade-level.js';
import { createSessionRecord, normalizeSessionRecord } from '../server/services/session-factory.js';

test('平台只接受四档学段名称，常见年级描述可在入口归一', () => {
  assert.deepEqual(GRADE_LEVELS, ['小学低年级', '小学高年级', '初中', '高中']);
  assert.equal(resolveGradeLevel('小学三年级'), '小学低年级');
  assert.equal(resolveGradeLevel('五年级'), '小学高年级');
  assert.equal(resolveGradeLevel('初二'), '初中');
  assert.equal(resolveGradeLevel('高一'), '高中');
  assert.equal(resolveGradeLevel('小学高年级 / 初中 / 高中'), DEFAULT_GRADE_LEVEL);
  assert.equal(canonicalGradeLevel('小学高年级 / 初中 / 高中'), null);
  assert.equal(canonicalGradeLevel('随便写'), null);
  assert.equal(isGradeLevel('五年级'), false);
});

test('会话记录保存学段来源，非法旧值不会继续污染运行时', () => {
  const selected = createSessionRecord({ courseId: 'c', grade: '高中', gradeSource: 'student_selected' });
  assert.equal(selected.grade, '高中');
  assert.equal(selected.learnerState.grade, '高中');
  assert.equal(selected.gradeSource, 'student_selected');

  const implicitClientSelection = createSessionRecord({ courseId: 'c', grade: '小学低年级' });
  assert.equal(implicitClientSelection.gradeSource, 'student_selected');

  const fallback = createSessionRecord({ courseId: 'c', grade: '小学高年级 / 初中 / 高中' });
  assert.equal(fallback.grade, '初中');
  assert.equal(fallback.gradeSource, 'platform_default');

  const normalized = normalizeSessionRecord({ ...selected, grade: '随便写', learnerState: { grade: '随便写' } });
  assert.equal(normalized.grade, '初中');
  assert.equal(normalized.learnerState.grade, '初中');
  assert.equal(normalized.gradeSource, 'legacy_migrated');

  const legacyClientSource = normalizeSessionRecord({ ...selected, gradeSource: 'client_selected' });
  assert.equal(legacyClientSource.gradeSource, 'legacy_migrated');
});

test('学生入口不要求学生选学段，演示会话默认初中', () => {
  const page = fs.readFileSync(
    fileURLToPath(new URL('../src/pages/student-learning.html', import.meta.url)),
    'utf8',
  );
  const controller = fs.readFileSync(
    fileURLToPath(new URL('../src/app-controller.js', import.meta.url)),
    'utf8',
  );
  assert.doesNotMatch(page, /id="gradeLevelSelect"/u);
  assert.match(controller, /DEFAULT_GRADE_LEVEL/u);
  assert.match(controller, /grade: state\.selectedGradeLevel/u);
  assert.match(controller, /gradeSource: state\.gradeSource/u);
  assert.doesNotMatch(controller, /请先选择你的学段/u);
});
