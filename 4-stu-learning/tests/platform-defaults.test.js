import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateNudge } from '../server/agent/nudge-policy.js';
import { clearCourseCache, compileCourse } from '../server/course/compiler.js';
import { loadPlatformDefaults } from '../server/course/platform-defaults.js';
import { documentEntries, mergeDefaults, parsePlatformDefaultDocument } from '../src/engine/platform-defaults.js';
import { TASK_DEFAULTS, parseLesson, resolveTaskDefaults } from '../src/engine/lesson-parser.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

function document(body, filename = 'sample.md') {
  return parsePlatformDefaultDocument(body, filename);
}

test('声明块解析：三种 merge 语义与锁定键都能读出来', () => {
  const byKey = document('# 标题\n\n> overridable: true\n> merge: by-key   # 逐键覆盖\n> course-field: 数值缺省\n\n## 节奏\n\n- 无操作提醒：3分钟\n');
  assert.deepEqual(byKey.declaration, {
    overridable: true, merge: 'by-key', courseField: '数值缺省', locked: [],
  });
  assert.deepEqual(byKey.sections['节奏'].entries, { 无操作提醒: '3分钟' });

  const replace = document('> overridable: true\n> merge: replace\n\n- 语气：温和\n');
  assert.equal(replace.declaration.merge, 'replace');
  assert.deepEqual(replace.entries, { 语气: '温和' });

  const append = document('> overridable: true\n> merge: append\n> locked: name、posterAsset\n\n- 口头禅：我们一起看看\n');
  assert.equal(append.declaration.merge, 'append');
  assert.deepEqual(append.declaration.locked, ['name', 'posterAsset']);
});

test('声明块非法取值直接报错，不静默按缺省处理', () => {
  assert.throws(() => document('> overridable: maybe\n'), /overridable 只能是 true 或 false/);
  assert.throws(() => document('> merge: deep-merge\n'), /merge 只能是/);
});

test('by-key 合并逐键覆盖，锁定键被拦下并产出 warning', () => {
  const source = document('> overridable: true\n> merge: by-key\n> locked: name\n\n- name：絮絮\n- tone：清晰自然\n', 'companion.md');
  const { entries, warnings } = mergeDefaults(source, { name: '小助手', tone: '冷静克制' });

  assert.equal(entries.name, '絮絮');
  assert.equal(entries.tone, '冷静克制');
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].key, 'name');
  assert.match(warnings[0].message, /companion\.md 锁定了「name」/);
});

test('replace 整体替换但保留锁定键，append 追加不丢平台原值', () => {
  const replaceDoc = document('> overridable: true\n> merge: replace\n> locked: name\n\n- name：絮絮\n- tone：清晰自然\n');
  const replaced = mergeDefaults(replaceDoc, { tone: '冷静克制' });
  assert.deepEqual(replaced.entries, { tone: '冷静克制', name: '絮絮' });

  const appendDoc = document('> overridable: true\n> merge: append\n\n- 口头禅：我们一起看看\n');
  const appended = mergeDefaults(appendDoc, { 口头禅: '再想一步' });
  assert.equal(appended.entries['口头禅'], '我们一起看看\n再想一步');
});

test('不可覆盖的文件：课程写什么都不生效，且每个键都有 warning', () => {
  const source = document('> overridable: false\n\n- 底线：不直接给答案\n', 'pedagogy-rules.md');
  const { entries, warnings } = mergeDefaults(source, { 底线: '可以给答案', 语气: '随意' });

  assert.deepEqual(entries, { 底线: '不直接给答案' });
  assert.equal(warnings.length, 2);
  assert.match(warnings[0].message, /pedagogy-rules\.md 不可覆盖/);
});

test('缺省层文件缺失时回落到代码常量，并留一条 debug 记录', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'platform-defaults-missing-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, '_platform'), { recursive: true });

  const logged = [];
  const loaded = await loadPlatformDefaults({ lessonsRoot: root, logger: { debug: (line) => logged.push(line) } });

  assert.deepEqual(loaded.missing, ['defaults.md']);
  assert.equal(loaded.documents.defaults, null);
  assert.equal(logged.length, 1);
  assert.match(logged[0], /_platform\/defaults\.md/);
  assert.deepEqual(resolveTaskDefaults({}), TASK_DEFAULTS);
});

test('缺省层版本随内容变化，内容不变则版本稳定', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'platform-defaults-version-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, '_platform');
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(directory, 'defaults.md');
  await fs.writeFile(file, '> overridable: true\n> merge: by-key\n\n- 无操作提醒：3分钟\n', 'utf8');

  const first = await loadPlatformDefaults({ lessonsRoot: root });
  const same = await loadPlatformDefaults({ lessonsRoot: root });
  assert.match(first.version, /^sha256:[a-f0-9]{64}$/);
  assert.equal(same.version, first.version);

  await fs.writeFile(file, '> overridable: true\n> merge: by-key\n\n- 无操作提醒：5分钟\n', 'utf8');
  const updated = await loadPlatformDefaults({ lessonsRoot: root });
  assert.notEqual(updated.version, first.version);
});

test('仓库里的 defaults.md 与代码常量一致：接入缺省层不改变现有行为', async () => {
  const loaded = await loadPlatformDefaults({ lessonsRoot });
  assert.deepEqual(loaded.missing, []);
  assert.deepEqual(resolveTaskDefaults(documentEntries(loaded.documents.defaults)), TASK_DEFAULTS);

  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  assert.match(course.platformDefaults.version, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(course.platformDefaults.warnings, []);
});

test('端到端：defaults.md 把无操作提醒改成 5 分钟，nudge-policy 的判定随之变化', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'platform-defaults-e2e-'));
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

  // 现有课程每个任务都自带「无操作提醒」，把它删掉才轮得到缺省层生效。
  const rolesDirectory = path.join(root, 'lesson_gewu_001', 'roles');
  for (const name of await fs.readdir(rolesDirectory)) {
    const file = path.join(rolesDirectory, name);
    const markdown = await fs.readFile(file, 'utf8');
    await fs.writeFile(file, markdown.replace(/^- 无操作提醒：.*$\n/gm, ''), 'utf8');
  }

  clearCourseCache();
  const before = await compileCourse({ lessonsRoot: root, courseId: 'lesson_gewu_001' });
  const taskOf = (course) => course.roles[0].tasks[0];
  assert.equal(taskOf(before).timing.idleNudgeSeconds, 3 * 60);

  await fs.writeFile(
    path.join(root, '_platform', 'defaults.md'),
    '> overridable: true\n> merge: by-key\n\n## 任务节奏\n\n- 无操作提醒：5分钟\n',
    'utf8',
  );
  const after = await compileCourse({ lessonsRoot: root, courseId: 'lesson_gewu_001' });
  const task = taskOf(after);
  assert.equal(task.timing.idleNudgeSeconds, 5 * 60);
  assert.equal(task.timing.suggestedSeconds, 15 * 60, '课程自己写的字段不受缺省层变化影响');

  const start = Date.parse('2026-08-07T09:00:00.000Z');
  const session = {
    conversationState: { nudgeCount: 0 },
    taskState: { lastMeaningfulActionAt: new Date(start).toISOString() },
    locationState: { status: 'arrived' },
  };
  const tick = { type: 'lifecycle_event', event: 'context_tick' };
  assert.equal(
    evaluateNudge({ session, task, input: tick, now: start + 4 * 60 * 1000 }).due,
    false,
    '门槛提到 5 分钟后，第 4 分钟不再提醒',
  );
  assert.equal(evaluateNudge({ session, task, input: tick, now: start + 6 * 60 * 1000 }).due, true);
});

test('课程 course.md 的 ## 数值缺省 覆盖平台缺省，但任务块字段优先级最高', () => {
  const platformDefaults = {
    documents: {
      defaults: parsePlatformDefaultDocument(
        '> overridable: true\n> merge: by-key\n\n- 无操作提醒：3分钟\n- 最大主动提醒：2\n',
        'defaults.md',
      ),
    },
  };
  const files = {
    'course.md': [
      '# 测试课程',
      '',
      '## 基本信息',
      '',
      '- 主题模板：test',
      '',
      '## 数值缺省',
      '',
      '- 无操作提醒：7分钟',
      '',
      '## 学生端角色体系',
      '',
      '- collectionName：合集',
      '- itemName：物件',
      '- collectionItemName：物件',
      '- collectionPanelName：面板',
      '- unlockTarget：终章',
      '- 任务阶段：phase-2',
      '',
    ].join('\n'),
    'phases.md': '',
    'roles/scout.md': [
      '# 侦察员',
      '',
      '## 基本信息',
      '',
      '- 收集物：线索',
      '- 收集物图：a.png',
      '- 角色卡图：b.png',
      '- 角色徽章图：c.png',
      '- 选择说明：看现场',
      '',
      '### 任务1：看水面',
      '',
      '- 通过条件：说出一处观察',
      '',
      '### 任务2：量坡度',
      '',
      '- 通过条件：给出一个估算',
      '- 无操作提醒：1分钟',
      '',
    ].join('\n'),
  };

  const lesson = parseLesson({ id: 'test', files, assetBase: 'assets' }, { platformDefaults });
  const [first, second] = lesson.roles[0].tasks;
  assert.equal(first.timing.idleNudgeSeconds, 7 * 60, '课程级覆盖生效');
  assert.equal(second.timing.idleNudgeSeconds, 60, '任务块字段仍然最高优先级');
  assert.equal(first.nudgePolicy.maxNudges, 2, '课程没写的键回落到平台缺省');
});
