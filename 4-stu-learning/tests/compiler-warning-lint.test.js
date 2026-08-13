import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { exitCodeForIssues, lintCourse } from '../scripts/lint-lesson.mjs';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

async function copiedCourse(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'compiler-warning-lint-'));
  t.after(async () => {
    clearCourseCache();
    await fs.rm(root, { recursive: true, force: true });
  });
  await fs.cp(path.join(lessonsRoot, '_platform'), path.join(root, '_platform'), { recursive: true });
  await fs.cp(
    path.join(lessonsRoot, 'lesson_gewu_001'),
    path.join(root, 'lesson_gewu_001'),
    { recursive: true },
  );
  return root;
}

test('unknown voice、locked 覆盖、unknown next 和重复任务全部进 strict lint', async (t) => {
  const root = await copiedCourse(t);
  const courseFile = path.join(root, 'lesson_gewu_001', 'course.md');
  await fs.appendFile(courseFile, [
    '',
    '## 人设侧重',
    '',
    '- name：试图改名',
    '',
    '## 话术覆盖',
    '',
    '- 不存在的流程键：这句不应静默丢失',
    '',
  ].join('\n'), 'utf8');

  const roleFile = path.join(root, 'lesson_gewu_001', 'roles', 'dragon-counter.md');
  const original = await fs.readFile(roleFile, 'utf8');
  const mutated = original
    .replace('- 通过后：role-stage:task-2', '- 通过后：role-stage:不存在的任务')
    .replace('- id：task-2\n', '- id：task-1\n');
  assert.notEqual(mutated, original, '负例必须真正改到角色源文');
  await fs.writeFile(roleFile, mutated, 'utf8');

  clearCourseCache();
  const course = await compileCourse({ lessonsRoot: root, courseId: 'lesson_gewu_001' });
  const expectedCodes = [
    'unknown_voice_key',
    'platform_locked_override',
    'unknown_next',
    'duplicate_task',
  ];

  for (const code of expectedCodes) {
    const warning = course.platformDefaults.warnings.find((item) => item.code === code);
    assert.ok(warning, `编译结果应包含 ${code}`);
    assert.ok(warning.source, `${code} 必须保留 source`);
    assert.ok(warning.field, `${code} 必须保留 field`);
  }

  const { issues, stats } = lintCourse(course, { lessonsRoot, courseId: course.id });
  const compilerIssues = issues.filter((item) => expectedCodes.includes(item.code));
  assert.equal(new Set(compilerIssues.map((item) => item.code)).size, expectedCodes.length);
  assert.ok(stats.compilerWarnings >= expectedCodes.length);
  for (const issue of compilerIssues) {
    assert.equal(issue.level, 'warning');
    assert.ok(issue.source, `${issue.code} lint issue 必须保留 source`);
    assert.ok(issue.field, `${issue.code} lint issue 必须保留 field`);
    assert.ok(issue.line > 0, `${issue.code} lint issue 必须可定位`);
  }
  assert.equal(exitCodeForIssues(compilerIssues), 0, '非 strict 允许仅 warning');
  assert.equal(exitCodeForIssues(compilerIssues, { strict: true }), 1, 'strict 必须拦截编译 warning');
});
