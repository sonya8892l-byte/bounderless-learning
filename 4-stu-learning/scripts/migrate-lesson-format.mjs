// 把课程包从 v1 布局迁移到 v2 任务单元格式。
//
// 做四件事：
//   1. guidance/<role>.md 的任务段 → roles/<role>.md 对应任务的 `##### 引导`
//   2. scaffolds/<role>.md 的任务表 → 对应任务的 `##### 脚手架`
//   3. Step 的 `评估引用` 命中的 evaluation.md 维度段 → 该 Step 的 `##### 验收标准`
//   4. 任务的 `目标关联` K/S/C → 追加 `- 能力标签：DK-*/DS-*/CQ-*`（原字段保留）
//
// 迁移后删除 guidance/、scaffolds/ 目录（--apply 时；先备份）。
// 默认 dry-run，只报告不写盘。用 --apply 落盘。

import { readFile, readdir, writeFile, rm, cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lessonsRoot = resolve(projectRoot, '../6-lessons');
const apply = process.argv.includes('--apply');
// --preview lesson_xxx/role-slug：把迁移结果写到 /tmp 供人工比对，不动源文件
const previewTarget = process.argv[process.argv.indexOf('--preview') + 1] || '';
const backupRoot = resolve('/tmp', `lessons-backup-${Date.now()}`);

const stats = {
  lessons: 0, roles: 0, guidance: 0, scaffold: 0, acceptance: 0, tags: 0, droppedRefs: 0, warnings: [],
};

function clean(value = '') {
  return String(value).trim();
}

// 按 `## 任务N` / `### 任务N: 标题` 抓取第 index+1 个任务段的正文（去掉标题行本身）。
function taskSectionBody(markdown = '', index, headingLevel) {
  const hashes = headingLevel.replaceAll('#', '\\#');
  const regex = new RegExp(`^${hashes}\\s*(?:任务|角色阶段)${index + 1}\\s*[：:].*$`, 'm');
  const match = markdown.match(regex);
  if (!match) return '';
  const start = match.index + match[0].length;
  const rest = markdown.slice(start);
  // 到下一个同级任务标题或更高级标题为止
  const next = rest.search(new RegExp(`^${hashes}\\s*(?:任务|角色阶段)\\d+\\s*[：:]|^#{1,${headingLevel.length}}\\s`, 'm'));
  return clean(next === -1 ? rest : rest.slice(0, next));
}

// 引导正文里的 ### 三级小标题降级为粗体，避免与任务单元的标题层级冲突；
// 去掉原文件里用于分隔任务的水平线。
function normalizeGuidance(body = '') {
  return clean(
    body
      .replace(/^###\s*(.+)$/gm, '**$1**')
      .replace(/^\s*---+\s*$/gm, '')
      .replace(/\n{3,}/g, '\n\n'),
  );
}

// 只保留 | L0 | … | 这样的等级行，丢掉表头与分隔线。
function normalizeScaffold(body = '') {
  const lines = body
    .split('\n')
    .filter((line) => /^\|\s*L[0-4]\s*\|/.test(line.trim()))
    .map((line) => clean(line));
  return lines.join('\n');
}

// evaluation.md 按维度组织，两种写法：
//   表格行 `| K1 排水系统构成 | 评估方式 | 证据来源 | 5分标准 |`
//   列表行 `- K1 排水系统构成：…`
// 取每个 K/S/C 编号的名称与达标标准（表格取最后一列＝5分标准）。
function parseEvaluationDimensions(markdown = '') {
  const result = new Map();
  for (const line of markdown.split('\n')) {
    const text = clean(line);
    if (text.startsWith('|')) {
      const cells = text.split('|').slice(1, -1).map(clean);
      const id = cells[0]?.match(/^([KSC]\d+)\b\s*(.*)$/);
      if (!id || cells.length < 2) continue;
      const criterion = cells.at(-1);
      result.set(id[1], [id[2], criterion].filter(Boolean).join(' — '));
      continue;
    }
    const listMatch = text.match(/^[-*]\s*([KSC]\d+)\s*[：:]?\s*(.+)$/);
    if (listMatch) result.set(listMatch[1], clean(listMatch[2]));
  }
  return result;
}

function acceptanceFor(step, dimensions) {
  const ids = [...String(step.evaluationRef || '').matchAll(/#([KSC]\d+)/g)].map((match) => match[1]);
  const lines = ids.map((id) => (dimensions.has(id) ? `- ${id} ${dimensions.get(id)}` : '')).filter(Boolean);
  if (!lines.length) return '';
  return [step.evidenceRequirement ? `${step.evidenceRequirement}` : '', ...lines]
    .filter(Boolean)
    .join('\n');
}

// K→DK 学科知识、S→DS 学科能力、C→DC 课程级核心能力。
// C 不映射到平台 CC/CQ：课程的 C 编号语义与平台树不一致（例如某课 C1=证据意识，
// 平台 CQ-1=自主学习），机械对齐会造成错标。DC 留在课程侧，等平台树定稿后人工对照。
const PREFIX_MAP = Object.freeze({ K: 'DK', S: 'DS', C: 'DC' });

function competencyTagsFrom(goals = '') {
  const tags = [...String(goals).matchAll(/\b([KSC])(\d+)/g)]
    .map((match) => `${PREFIX_MAP[match[1]]}-${match[2].padStart(2, '0')}`);
  return [...new Set(tags)];
}

// 把角色文件切成 [任务前的头部, 任务块...]。任务块含自己的标题行。
function splitRoleTasks(markdown) {
  const matches = [...markdown.matchAll(/^###\s*(?:任务|角色阶段)\d+\s*[：:].*$/gm)];
  if (!matches.length) return { head: markdown, tasks: [], tail: '' };
  // Phase 3 之后的内容属于角色尾部，不属于最后一个任务
  const tailIndex = markdown.search(/^##\s+Phase\s*3/m);
  const bodyEnd = tailIndex === -1 ? markdown.length : tailIndex;
  const head = markdown.slice(0, matches[0].index);
  const tasks = matches.map((match, index) => {
    const end = Math.min(matches[index + 1]?.index ?? bodyEnd, bodyEnd);
    return markdown.slice(match.index, end);
  });
  return { head, tasks, tail: tailIndex === -1 ? '' : markdown.slice(bodyEnd) };
}

// 在任务块的字段区末尾（第一个 #### Step 之前）插入就地段落。
function insertTaskSections(taskBlock, sections) {
  const bodies = sections.filter((section) => section.body);
  if (!bodies.length) return taskBlock;
  const text = bodies.map((section) => `##### ${section.label}\n${section.body}`).join('\n\n');
  const firstStep = taskBlock.search(/^####\s*(?:Step|小步)\s*\d+\s*[：:]/m);
  if (firstStep === -1) return `${clean(taskBlock)}\n\n${text}\n`;
  return `${clean(taskBlock.slice(0, firstStep))}\n\n${text}\n\n${taskBlock.slice(firstStep)}`;
}

// 在 Step 块末尾追加就地段落。
function insertStepSections(stepBlock, sections) {
  const bodies = sections.filter((section) => section.body);
  if (!bodies.length) return stepBlock;
  const text = bodies.map((section) => `##### ${section.label}\n${section.body}`).join('\n\n');
  return `${clean(stepBlock)}\n\n${text}\n`;
}

function splitSteps(taskBlock) {
  const matches = [...taskBlock.matchAll(/^####\s*(?:Step|小步)\s*\d+\s*[：:].*$/gm)];
  if (!matches.length) return { head: taskBlock, steps: [] };
  return {
    head: taskBlock.slice(0, matches[0].index),
    steps: matches.map((match, index) => taskBlock.slice(
      match.index,
      matches[index + 1]?.index ?? taskBlock.length,
    )),
  };
}

function fieldValue(block, name) {
  return clean(block.match(new RegExp(`^-\\s*${name}\\s*[：:]\\s*(.+)$`, 'm'))?.[1] || '');
}

// 在指定字段之后插入一行；找不到锚点时插在字段区末尾。
function addFieldLine(block, line, afterField) {
  const anchor = block.match(new RegExp(`^-\\s*${afterField}\\s*[：:].*$`, 'm'));
  if (!anchor) return block;
  const at = anchor.index + anchor[0].length;
  return `${block.slice(0, at)}\n${line}${block.slice(at)}`;
}

function migrateRole({ roleMarkdown, guidanceMarkdown, scaffoldMarkdown, dimensions, lessonId, roleId }) {
  const { head, tasks, tail } = splitRoleTasks(roleMarkdown);
  if (!tasks.length) {
    stats.warnings.push(`${lessonId}/${roleId}：未找到任务标题，跳过`);
    return roleMarkdown;
  }

  const migratedTasks = tasks.map((taskBlock, taskIndex) => {
    let block = taskBlock;

    // 4. 能力标签（原 目标关联 保留不动）
    const goals = fieldValue(block, '目标关联');
    const tags = competencyTagsFrom(goals);
    if (tags.length && !fieldValue(block, '能力标签')) {
      block = addFieldLine(block, `- 能力标签：${tags.join(', ')}`, '目标关联');
      stats.tags += 1;
    }

    // 3. Step 级验收标准
    const { head: taskHead, steps } = splitSteps(block);
    const migratedSteps = steps.map((stepBlock) => {
      const acceptance = acceptanceFor(
        {
          evaluationRef: fieldValue(stepBlock, '评估引用'),
          evidenceRequirement: fieldValue(stepBlock, '证据要求'),
        },
        dimensions,
      );
      if (acceptance) stats.acceptance += 1;
      const withSections = insertStepSections(stepBlock, [{ label: '验收标准', body: acceptance }]);
      // v2 废止的三类引用：内容已就地，字段本身会指向被删除的文件。
      return withSections.replace(/^-\s*(?:引导引用|脚手架引用|评估引用)\s*[：:].*\n?/gm, () => {
        stats.droppedRefs += 1;
        return '';
      });
    });
    block = migratedSteps.length ? `${taskHead}${migratedSteps.join('\n')}` : block;

    // 1+2. 任务级引导与脚手架
    // 引导与脚手架的任务标题层级各课不一（## 或 ###），两级都试。
    const guidance = normalizeGuidance(
      taskSectionBody(guidanceMarkdown, taskIndex, '##') || taskSectionBody(guidanceMarkdown, taskIndex, '###'),
    );
    const scaffold = normalizeScaffold(
      taskSectionBody(scaffoldMarkdown, taskIndex, '###') || taskSectionBody(scaffoldMarkdown, taskIndex, '##'),
    );
    if (guidance) stats.guidance += 1;
    else if (guidanceMarkdown) stats.warnings.push(`${lessonId}/${roleId}：任务${taskIndex + 1} 未匹配到引导段`);
    if (scaffold) stats.scaffold += 1;
    else if (scaffoldMarkdown) stats.warnings.push(`${lessonId}/${roleId}：任务${taskIndex + 1} 未匹配到脚手架表`);

    return insertTaskSections(block, [
      { label: '引导', body: guidance },
      { label: '脚手架', body: scaffold },
    ]);
  });

  return `${head}${migratedTasks.join('\n')}${tail ? `\n${tail}` : ''}`;
}

async function migrateLesson(lessonId) {
  const lessonDir = resolve(lessonsRoot, lessonId);
  const roleDir = resolve(lessonDir, 'roles');
  let roleFiles;
  try {
    roleFiles = (await readdir(roleDir)).filter((name) => name.endsWith('.md'));
  } catch {
    stats.warnings.push(`${lessonId}：无 roles/ 目录，跳过`);
    return;
  }

  const evaluation = await readFile(resolve(lessonDir, 'evaluation.md'), 'utf8').catch(() => '');
  const dimensions = parseEvaluationDimensions(evaluation);
  if (!dimensions.size) stats.warnings.push(`${lessonId}：evaluation.md 无 K/S/C 维度行，验收标准将为空`);

  for (const filename of roleFiles) {
    const roleId = filename.replace(/\.md$/, '');
    const roleMarkdown = await readFile(resolve(roleDir, filename), 'utf8');
    if (/^#####\s*(?:引导|脚手架|验收标准)\s*$/m.test(roleMarkdown)) {
      // 已迁移过：只做废止引用字段的清理，不重复插入就地段落。
      const cleaned = roleMarkdown.replace(/^-\s*(?:引导引用|脚手架引用|评估引用)\s*[：:].*\n?/gm, () => {
        stats.droppedRefs += 1;
        return '';
      });
      if (apply && cleaned !== roleMarkdown) await writeFile(resolve(roleDir, filename), cleaned, 'utf8');
      if (cleaned === roleMarkdown) stats.warnings.push(`${lessonId}/${roleId}：已迁移且无残留引用，跳过`);
      stats.roles += 1;
      continue;
    }
    const guidanceMarkdown = await readFile(resolve(lessonDir, 'guidance', filename), 'utf8').catch(() => '');
    const scaffoldMarkdown = await readFile(resolve(lessonDir, 'scaffolds', filename), 'utf8').catch(() => '');
    const migrated = migrateRole({
      roleMarkdown, guidanceMarkdown, scaffoldMarkdown, dimensions, lessonId, roleId,
    });
    if (apply && migrated !== roleMarkdown) await writeFile(resolve(roleDir, filename), migrated, 'utf8');
    if (previewTarget && `${lessonId}/${roleId}` === previewTarget) {
      await writeFile(resolve('/tmp', `preview-${roleId}.md`), migrated, 'utf8');
      console.log(`已写出预览：/tmp/preview-${roleId}.md`);
    }
    stats.roles += 1;
  }
  stats.lessons += 1;
}

const lessonIds = (await readdir(lessonsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .map((entry) => entry.name)
  .sort();

if (apply) {
  await mkdir(backupRoot, { recursive: true });
  for (const lessonId of lessonIds) {
    await cp(resolve(lessonsRoot, lessonId), resolve(backupRoot, lessonId), { recursive: true });
  }
  console.log(`已备份 ${lessonIds.length} 门课程到 ${backupRoot}`);
}

for (const lessonId of lessonIds) await migrateLesson(lessonId);

if (apply) {
  for (const lessonId of lessonIds) {
    for (const legacy of ['guidance', 'scaffolds']) {
      await rm(resolve(lessonsRoot, lessonId, legacy), { recursive: true, force: true });
    }
  }
  console.log('已删除 guidance/、scaffolds/ 目录（内容已并入任务单元，原件在备份中）');
}

console.log([
  apply ? '=== 迁移完成 ===' : '=== dry-run（未写盘，加 --apply 落盘）===',
  `课程 ${stats.lessons} 门｜角色 ${stats.roles} 个`,
  `就地引导 ${stats.guidance} 段｜就地脚手架 ${stats.scaffold} 段｜Step 验收标准 ${stats.acceptance} 段｜能力标签 ${stats.tags} 处`,
  `删除废止引用 ${stats.droppedRefs} 行（引导引用/脚手架引用/评估引用）`,
].join('\n'));

if (stats.warnings.length) {
  console.log(`\n告警 ${stats.warnings.length} 条：`);
  for (const warning of stats.warnings.slice(0, 30)) console.log(`  - ${warning}`);
  if (stats.warnings.length > 30) console.log(`  …另有 ${stats.warnings.length - 30} 条`);
}
