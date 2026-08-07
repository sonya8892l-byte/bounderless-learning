import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const specPath = path.join(repoRoot, '6-lessons/COURSE-SUBMISSION-SPEC.md');
const serverRoot = path.join(repoRoot, '4-stu-learning/server');

/**
 * 附录 A 中文字段 → server/ 内应出现的标识符。
 * 依据 src/engine/lesson-parser.js 的解析键与编译后属性名。
 */
const FIELD_IDENTIFIERS = {
  id: ['completedTaskIds', 'toolInstanceId', 'pending.taskId', 'completedId'],
  'prompts/phaseN-*.md': ['phasePrompt', 'phasePrompts', 'session.phaseId'],
  配置: ['task.requirement', '.requirement'],
  通过条件: ['passCondition'],
  推进方式: ['advanceMode', 'pendingAdvance'],
  任务图: ['task.image'],
  位置模式: ['location.mode', 'locationMode', 'taskRequiresArrival'],
  位置: ['step?.location', 'task.location', 'locationState'],
  地点: ['location.name', 'location?.name'],
  坐标: ['coordinates', 'parseCoordinates'],
  围栏半径: ['radiusMeters'],
  最短停留: ['minDwellSeconds'],
  到达验证: ['arrivalVerification', '.verification'],
  建议时长: ['suggestedSeconds'],
  无操作提醒: ['idleNudgeSeconds'],
  提醒冷却: ['nudgeCooldownSeconds'],
  最大主动提醒: ['maxNudges'],
  功能模块: ['modules', 'resolveActivityTools'],
  工具参数: ['toolParameters', 'publicConfig'],
  小步目标: ['objective'],
  学生行动: ['studentAction'],
  证据要求: ['evidenceRequirement'],
  完成方式: ['completionMode'],
  最大尝试: ['maxAttempts'],
  知识引用: ['knowledgeRef'],
  限制引用: ['restrictionRef'],
  AI引导方向: ['task.guide', '.guide'],
  常见误区: ['commonMisconception'],
  失败处理: ['failureHandling'],
  教师介入: ['teacherIntervention'],
};

function stripMarkdown(cell = '') {
  return cell.replace(/\*\*/g, '').trim();
}

function extractFieldTokens(fieldCell = '') {
  const tokens = [];
  for (const match of fieldCell.matchAll(/`([^`]+)`/g)) {
    const raw = match[1].trim();
    // 路径型字段（含通配符或 .md）整段保留，不按 / 拆开
    if (/[*?]|\.md/.test(raw) || raw.startsWith('prompts/')) {
      tokens.push(raw);
      continue;
    }
    for (const part of raw.split('/')) {
      const token = part.trim();
      if (token) tokens.push(token);
    }
  }
  return tokens;
}

function isActiveStatus(statusCell = '') {
  const status = stripMarkdown(statusCell);
  if (!status.includes('生效')) return false;
  if (/未接|预留|废止/.test(status)) return false;
  return true;
}

function parseAppendixRows(markdown) {
  const appendixStart = markdown.indexOf('## 附录 A');
  assert.ok(appendixStart >= 0, '找不到附录 A');
  const section = markdown.slice(appendixStart);
  const lines = section.split('\n');
  const headerIndex = lines.findIndex((line) => line.startsWith('| 字段 |'));
  assert.ok(headerIndex >= 0, '找不到附录 A 表头');

  const rows = [];
  for (let i = headerIndex + 2; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith('|')) break;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 4) continue;
    rows.push({
      fieldCell: cells[0],
      statusCell: cells[3],
      fields: extractFieldTokens(cells[0]),
    });
  }
  return rows;
}

async function loadServerSources(root) {
  const entries = [];
  async function walk(dir) {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        await walk(fullPath);
      } else if (item.name.endsWith('.js')) {
        entries.push([fullPath, await readFile(fullPath, 'utf8')]);
      }
    }
  }
  await walk(root);
  return entries;
}

function hasConsumer(sources, identifiers = []) {
  return identifiers.some((identifier) => sources.some(([, content]) => content.includes(identifier)));
}

test('附录 A 标「生效」的字段在 server/ 下有消费者', async () => {
  const markdown = await readFile(specPath, 'utf8');
  const rows = parseAppendixRows(markdown).filter((row) => isActiveStatus(row.statusCell));
  const sources = await loadServerSources(serverRoot);

  const unmapped = [];
  const missing = [];

  for (const row of rows) {
    for (const field of row.fields) {
      const identifiers = FIELD_IDENTIFIERS[field];
      if (!identifiers) {
        unmapped.push({ field, row: row.fieldCell, status: stripMarkdown(row.statusCell) });
        continue;
      }
      if (!hasConsumer(sources, identifiers)) {
        missing.push({
          field,
          row: row.fieldCell,
          status: stripMarkdown(row.statusCell),
          identifiers,
        });
      }
    }
  }

  if (unmapped.length) {
    console.warn('[spec-appendix-status] 以下「生效」字段无标识符映射，需人工补映射：');
    for (const item of unmapped) {
      console.warn(`  - ${item.field}（${item.row}｜${item.status}）`);
    }
  }

  assert.equal(
    missing.length,
    0,
    missing.map((item) => (
      `字段「${item.field}」（${item.row}）标为「${item.status}」，`
      + `但在 server/ 未找到消费者标识符：${item.identifiers.join(', ')}`
    )).join('\n'),
  );
});
