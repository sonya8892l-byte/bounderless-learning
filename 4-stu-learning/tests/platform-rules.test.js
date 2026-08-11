import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearCourseCache, compileCourse, compilePlatformRules } from '../server/course/compiler.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

test('平台规则包按固定顺序编译进服务端课程对象', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });

  assert.match(course.platformRules.version, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(
    course.platformRules.documents.map((document) => document.id),
    ['safety', 'pedagogy', 'privacy'],
  );
  assert.match(course.platformRules.prompt, /禁止建议学生攀爬、跳跃、靠近水域边缘/);
  assert.match(course.platformRules.prompt, /必须通过追问、引导、提示让学生自己得出结论/);
  assert.match(course.platformRules.prompt, /不主动询问学生的家庭信息、联系方式、健康状况/);
  assert.equal(Object.keys(course.files).some((filename) => filename.startsWith('_platform/')), false);
  assert.doesNotMatch(JSON.stringify(course.lesson), /禁止建议学生攀爬/);
});

test('平台规则内容变化会生成新的稳定版本', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'platform-rules-version-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, '_platform');
  await fs.mkdir(directory, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(directory, 'safety-rules.md'), '# 安全\n\n- 规则A\n', 'utf8'),
    fs.writeFile(path.join(directory, 'pedagogy-rules.md'), '# 教学\n\n- 规则B\n', 'utf8'),
    fs.writeFile(path.join(directory, 'privacy-rules.md'), '# 隐私\n\n- 规则C\n', 'utf8'),
  ]);

  const first = await compilePlatformRules({ lessonsRoot: root });
  const same = await compilePlatformRules({ lessonsRoot: root });
  assert.equal(same.version, first.version);

  await fs.writeFile(path.join(directory, 'pedagogy-rules.md'), '# 教学\n\n- 更新后的规则B\n', 'utf8');
  const updated = await compilePlatformRules({ lessonsRoot: root });
  assert.notEqual(updated.version, first.version);
  assert.match(updated.prompt, /更新后的规则B/);
});

test('平台规则版本变化会使课程缓存失效', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'platform-rules-course-cache-'));
  t.after(async () => {
    clearCourseCache();
    await fs.rm(root, { recursive: true, force: true });
  });
  await fs.cp(path.join(lessonsRoot, '_platform'), path.join(root, '_platform'), { recursive: true });
  const sourceCourse = path.join(lessonsRoot, 'lesson_gewu_001');
  await fs.cp(sourceCourse, path.join(root, 'lesson_gewu_001'), {
    recursive: true,
    filter: (source) => !path.relative(sourceCourse, source).split(path.sep).includes('assets'),
  });

  clearCourseCache();
  const first = await compileCourse({ lessonsRoot: root, courseId: 'lesson_gewu_001' });
  const pedagogyFile = path.join(root, '_platform', 'pedagogy-rules.md');
  await fs.appendFile(pedagogyFile, '\n- 缓存更新测试规则\n', 'utf8');
  const updated = await compileCourse({ lessonsRoot: root, courseId: 'lesson_gewu_001' });

  assert.notStrictEqual(updated, first);
  assert.notEqual(updated.platformRules.version, first.platformRules.version);
  assert.match(updated.platformRules.prompt, /缓存更新测试规则/);
});

test('平台规则缺少必需文件时编译失败', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'platform-rules-required-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, '_platform');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'safety-rules.md'), '# 安全\n', 'utf8');
  await fs.writeFile(path.join(directory, 'pedagogy-rules.md'), '# 教学\n', 'utf8');

  await assert.rejects(
    compilePlatformRules({ lessonsRoot: root }),
    /平台规则缺少必需文件：_platform\/privacy-rules\.md/,
  );
});
