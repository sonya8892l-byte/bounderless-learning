import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const specPath = path.join(repoRoot, '6-lessons/COURSE-SUBMISSION-SPEC.md');

/**
 * 附录 A 中每个「生效」字段必须绑定到具体运行文件和精确读取标识。
 * 这里不扫全仓猜“好像有同名字符串”：每个 contract 都是可审阅的真实消费点。
 */
const ACTIVE_FIELD_CONSUMERS = Object.freeze({
  id: [{ file: '4-stu-learning/server/agent/service.js', contains: ['completedTaskIds'] }],
  'Phase.名称': [{ file: '4-stu-learning/server/agent/prompt.js', contains: ['phase?.name'] }],
  'Phase.时长': [{ file: '4-stu-learning/server/course/agent-context.js', contains: ['phase?.duration'] }],
  'Phase.模式': [{ file: '4-stu-learning/server/course/agent-context.js', contains: ['phase?.mode'] }],
  'Phase.地点': [{ file: '4-stu-learning/server/course/agent-context.js', contains: ['phase?.location'] }],
  'prompts/phaseN-*.md': [{
    file: '4-stu-learning/server/course/agent-context.js',
    contains: ['course.phasePrompts?.[session?.phaseId]'],
  }],
  配置: [{ file: '4-stu-learning/server/agent/prompt.js', contains: ['task.requirement'] }],
  通过条件: [{ file: '4-stu-learning/server/agent/prompt.js', contains: ['task.passCondition'] }],
  收口方式: [{ file: '4-stu-learning/server/agent/service.js', contains: ['task.finalizationMode'] }],
  推进方式: [{ file: '4-stu-learning/server/agent/task-advance.js', contains: ['task?.advanceMode'] }],
  任务图: [{ file: '4-stu-learning/src/app-controller.js', contains: ['return task.image || role.cardImage'] }],
  位置模式: [{ file: '4-stu-learning/server/agent/session-state.js', contains: ['task?.location?.mode'] }],
  位置: [{ file: '4-stu-learning/server/agent/session-state.js', contains: ['locationDefaults(task)'] }],
  地点: [{ file: '4-stu-learning/server/agent/tools.js', contains: ['task.location?.name'] }],
  坐标: [{ file: '4-stu-learning/server/agent/tools.js', contains: ['task.location?.coordinates'] }],
  围栏半径: [{ file: '4-stu-learning/server/agent/session-state.js', contains: ['task?.location?.radiusMeters'] }],
  最短停留: [{ file: '4-stu-learning/server/agent/session-state.js', contains: ['task?.location?.minDwellSeconds'] }],
  到达验证: [{ file: '4-stu-learning/server/agent/session-state.js', contains: ['task?.location?.verification'] }],
  建议时长: [{ file: '4-stu-learning/server/agent/service.js', contains: ['task.timing?.suggestedSeconds'] }],
  无操作提醒: [{ file: '4-stu-learning/server/agent/nudge-policy.js', contains: ['task?.timing?.idleNudgeSeconds'] }],
  提醒冷却: [{ file: '4-stu-learning/server/agent/nudge-policy.js', contains: ['task?.timing?.nudgeCooldownSeconds'] }],
  最大主动提醒: [{ file: '4-stu-learning/server/agent/nudge-policy.js', contains: ['task?.nudgePolicy?.maxNudges'] }],
  功能模块: [{ file: '4-stu-learning/server/agent/tools.js', contains: ['modules: tool.modules'] }],
  工具参数: [{ file: '4-stu-learning/server/agent/service.js', contains: ['tool.config'] }],
  小步目标: [{ file: '4-stu-learning/server/agent/service.js', contains: ['step.objective'] }],
  学生行动: [{ file: '4-stu-learning/server/agent/service.js', contains: ['step.studentAction'] }],
  证据要求: [{ file: '4-stu-learning/server/agent/service.js', contains: ['step.evidenceRequirement'] }],
  完成方式: [{ file: '4-stu-learning/server/agent/service.js', contains: ['step.completionMode'] }],
  最大尝试: [{ file: '4-stu-learning/server/agent/service.js', contains: ['step.maxAttempts'] }],
  知识引用: [{ file: '4-stu-learning/server/agent/service.js', contains: ['step.knowledgeRef'] }],
  限制引用: [{
    file: '4-stu-learning/server/course/restriction-sections.js',
    contains: ['step?.restrictionRef'],
  }],
  AI引导方向: [
    { file: '4-stu-learning/server/course/compiler.js', contains: ['task.guide'] },
    { file: '4-stu-learning/server/course/agent-context.js', contains: ['task?.guidance'] },
  ],
  '##### 引导': [{
    file: '4-stu-learning/server/course/agent-context.js',
    contains: ['step?.guidance || task?.guidance'],
  }],
  '##### 脚手架': [{
    file: '4-stu-learning/server/agent/prompt.js',
    contains: ['step?.scaffold', 'task.scaffold'],
  }],
  '##### 验收标准': [{
    file: '4-stu-learning/server/agent/service.js',
    contains: ['step.acceptance || task.acceptance'],
  }],
  常见误区: [{ file: '4-stu-learning/server/agent/prompt.js', contains: ['currentStep?.commonMisconception'] }],
  前置: [{ file: '4-stu-learning/server/agent/task-advance.js', contains: ['node.prerequisites'] }],
  '### 阶段任务N': [{
    file: '4-stu-learning/src/engine/entry-phase.js',
    contains: ['phases.slice(0, rolePhaseIndex + 1)', 'phase.tasks.length > 0'],
  }],
  '通过后：role-stage:<id>': [
    { file: '4-stu-learning/server/course/task-graph.js', contains: ["kind === 'role-stage'"] },
    { file: '4-stu-learning/server/agent/task-advance.js', contains: ['advanceWithGraph'] },
  ],
});

function stripMarkdown(cell = '') {
  return cell.replace(/\*\*/g, '').trim();
}

function extractFieldTokens(fieldCell = '') {
  const tokens = [];
  const phasePrefix = /^Phase\b/.test(stripMarkdown(fieldCell)) ? 'Phase.' : '';
  for (const match of fieldCell.matchAll(/`([^`]+)`/g)) {
    const raw = match[1].trim();
    if (/[*?]|\.md/.test(raw) || raw.startsWith('prompts/')) {
      tokens.push(raw);
      continue;
    }
    for (const part of raw.split(/[\/／]/)) {
      const token = part.trim();
      if (token) tokens.push(`${phasePrefix}${token}`);
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

function assertActiveFieldsHaveMappings(rows) {
  const unmapped = [];
  for (const row of rows) {
    assert.ok(row.fields.length > 0, `生效行没有可映射的字段 token：${row.fieldCell}`);
    for (const field of row.fields) {
      if (!ACTIVE_FIELD_CONSUMERS[field]?.length) {
        unmapped.push({ field, row: row.fieldCell, status: stripMarkdown(row.statusCell) });
      }
    }
  }
  assert.equal(
    unmapped.length,
    0,
    unmapped.map((item) => (
      `字段「${item.field}」（${item.row}）标为「${item.status}」，但没有消费者契约`
    )).join('\n'),
  );
}

test('负例：新字段只要标「生效」却没有消费者契约，测试立即硬失败', () => {
  const synthetic = [
    '## 附录 A：字段 → 消费点对照表',
    '',
    '| 字段 | 层级 | 消费点 | 状态 |',
    '|---|---|---|---|',
    '| `尚未实现的新字段` | 任务 | 暂无 | **生效** |',
  ].join('\n');
  const rows = parseAppendixRows(synthetic).filter((row) => isActiveStatus(row.statusCell));
  assert.throws(
    () => assertActiveFieldsHaveMappings(rows),
    /没有消费者契约/,
  );
});

test('附录 A 所有标「生效」的字段都有可验证的真实消费者', async () => {
  const markdown = await readFile(specPath, 'utf8');
  const rows = parseAppendixRows(markdown).filter((row) => isActiveStatus(row.statusCell));
  const activeFields = new Set(rows.flatMap((row) => row.fields));
  const missing = [];

  assertActiveFieldsHaveMappings(rows);

  for (const row of rows) {
    for (const field of row.fields) {
      const contracts = ACTIVE_FIELD_CONSUMERS[field];
      for (const contract of contracts) {
        let source = '';
        try {
          source = await readFile(path.join(repoRoot, contract.file), 'utf8');
        } catch {
          missing.push({ field, contract, reason: '消费文件不存在' });
          continue;
        }
        const absent = contract.contains.filter((identifier) => !source.includes(identifier));
        if (absent.length) missing.push({ field, contract, reason: `缺少标识符 ${absent.join(', ')}` });
      }
    }
  }

  assert.equal(
    missing.length,
    0,
    missing.map((item) => (
      `字段「${item.field}」的消费者 ${item.contract.file} 无效：${item.reason}`
    )).join('\n'),
  );

  const staleMappings = Object.keys(ACTIVE_FIELD_CONSUMERS).filter((field) => !activeFields.has(field));
  assert.deepEqual(
    staleMappings,
    [],
    `消费者映射已与 SPEC 的生效状态漂移：${staleMappings.join(', ')}`,
  );
});
