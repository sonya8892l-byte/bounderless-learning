import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlatformDefaults } from '../server/course/platform-defaults.js';
import { parseLesson } from '../src/engine/lesson-parser.js';
import { TOOL_FIELD_LABEL_DEFAULTS, TOOL_NAME_DEFAULTS, resolveToolDefaults } from '../src/engine/tool-defaults.js';
import { resolveActivityTools } from '../src/engine/tool-registry.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

test('tool-defaults.md 的 10 个显示名与默认 label 与代码常量一致', async () => {
  const loaded = await loadPlatformDefaults({ lessonsRoot });
  const { toolDefaults } = resolveToolDefaults(loaded.documents.toolDefaults);
  assert.deepEqual(toolDefaults.names, TOOL_NAME_DEFAULTS);
  assert.deepEqual(toolDefaults.fieldLabels, TOOL_FIELD_LABEL_DEFAULTS);
});

test('解析工具时显示名来自默认层；中文正则匹配器仍在代码里', () => {
  const { toolDefaults } = resolveToolDefaults(null, { photo: '现场拍照', 'text.observation': '我的观察' });
  const [photo] = resolveActivityTools('A01（拍照）', '', toolDefaults);
  assert.equal(photo.name, '现场拍照');

  const [scanner] = resolveActivityTools('A07（实物识别）', '', toolDefaults);
  assert.equal(scanner.config.mode, 'object', '实物|识别 匹配逻辑未搬走');
  assert.equal(scanner.name, '扫码识别');

  const [text] = resolveActivityTools('A01（文字）', '', toolDefaults);
  assert.equal(text.config.fields[0].label, '我的观察');
});

test('课程 tool parameters 写了 fields 时不被平台默认 label 覆盖', () => {
  const { toolDefaults } = resolveToolDefaults(null, { 'text.observation': '平台观察' });
  const [text] = resolveActivityTools(
    'A01（文字）',
    '{"fields":[{"id":"observation","label":"课程自定义","type":"long_text","required":true}]}',
    toolDefaults,
  );
  assert.equal(text.config.fields[0].label, '课程自定义');
});

test('公开包编译与服务端读同一份 tool-defaults：改显示名两端一致', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tool-defaults-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.cp(path.join(lessonsRoot, '_platform'), path.join(root, '_platform'), { recursive: true });
  await fs.writeFile(
    path.join(root, '_platform', 'tool-defaults.md'),
    '> overridable: true\n> merge: by-key\n\n## 显示名\n\n- photo：采证拍照\n',
    'utf8',
  );
  const sourceCourse = path.join(lessonsRoot, 'lesson_gewu_001');
  await fs.cp(sourceCourse, path.join(root, 'lesson_gewu_001'), {
    recursive: true,
    filter: (source) => !path.relative(sourceCourse, source).split(path.sep).includes('assets'),
  });

  const platformDefaults = await loadPlatformDefaults({ lessonsRoot: root });
  const files = {};
  async function collect(directory, base = directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await collect(full, base);
      else if (entry.name.endsWith('.md')) {
        files[path.relative(base, full).replaceAll('\\', '/')] = await fs.readFile(full, 'utf8');
      }
    }
  }
  await collect(path.join(root, 'lesson_gewu_001'));
  const lesson = parseLesson({ id: 'lesson_gewu_001', files, assetBase: 'assets' }, { platformDefaults });
  const tools = lesson.roles.flatMap((role) => role.tasks.flatMap((task) => [
    ...(task.tools || []),
    ...(task.steps || []).flatMap((step) => step.tools || []),
  ]));
  const photo = tools.find((tool) => tool.id === 'photo');
  assert.ok(photo, '课程里应至少有一个拍照工具实例');
  assert.equal(photo.name, '采证拍照');
});
