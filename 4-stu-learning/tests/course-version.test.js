import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { compileCourse, clearCourseCache } from '../server/course/compiler.js';

const lessonsRoot = resolve(import.meta.dirname, '../../6-lessons');

/** 把 6-lessons 复制到临时目录，改课程 md 不污染仓库。 */
async function scratchLessons() {
  const root = await mkdtemp(resolve(tmpdir(), 'lessons-version-'));
  await cp(lessonsRoot, root, { recursive: true });
  return root;
}

test('contentVersion 与 courseVersion 都是稳定的 sha256', async () => {
  clearCourseCache();
  const first = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  clearCourseCache();
  const second = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });

  assert.match(first.contentVersion, /^sha256:[0-9a-f]{64}$/);
  assert.match(first.courseVersion, /^sha256:[0-9a-f]{64}$/);
  assert.equal(first.contentVersion, second.contentVersion, '内容没变，指纹就不该变');
  assert.equal(first.schemaVersion, 1);
});

test('不同课程的 contentVersion 不同', async () => {
  clearCourseCache();
  const gewu = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const zhuhun = await compileCourse({ lessonsRoot, courseId: 'lesson_zhuhun_001' });
  assert.notEqual(gewu.contentVersion, zhuhun.contentVersion);
});

test('改课程 md 后不重启也能拿到新版本：缓存按内容失效', async () => {
  const root = await scratchLessons();
  try {
    clearCourseCache();
    const before = await compileCourse({ lessonsRoot: root, courseId: 'lesson_gewu_001' });

    // 不清缓存，直接改文件——这正是"改 md 必须重启"曾经的症状。
    const rolePath = resolve(root, 'lesson_gewu_001/roles/dragon-counter.md');
    const markdown = await readFile(rolePath, 'utf8');
    await writeFile(rolePath, `${markdown}\n<!-- 内容指纹测试 -->\n`, 'utf8');

    const after = await compileCourse({ lessonsRoot: root, courseId: 'lesson_gewu_001' });

    assert.notEqual(after.courseVersion, before.courseVersion, '课程指纹必须跟着 md 变');
    assert.notEqual(after.contentVersion, before.contentVersion, '联合指纹必须跟着 md 变');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('作者说明文档不进入课程版本，也不进入运行时 sourceFiles', async () => {
  const root = await scratchLessons();
  try {
    clearCourseCache();
    const before = await compileCourse({ lessonsRoot: root, courseId: 'lesson_gewu_001' });
    assert.equal(before.sourceFiles['README.md'], undefined);
    assert.equal(before.sourceFiles['assets-checklist.md'], undefined);

    const readmePath = resolve(root, 'lesson_gewu_001/README.md');
    const markdown = await readFile(readmePath, 'utf8');
    await writeFile(readmePath, `${markdown}\n<!-- 作者说明更新 -->\n`, 'utf8');

    const after = await compileCourse({ lessonsRoot: root, courseId: 'lesson_gewu_001' });
    assert.equal(after, before, '只改作者说明应继续命中运行时课程缓存');
    assert.equal(after.courseVersion, before.courseVersion);
    assert.equal(after.contentVersion, before.contentVersion);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('课程 md 没变时命中缓存，返回同一个对象', async () => {
  clearCourseCache();
  const first = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const second = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  assert.equal(first, second, '内容未变应命中缓存，避免每次请求重新解析');
});
