import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  dispatchTeacherCommand,
  STUDENT_TEACHER_COMMAND_ACTIONS,
} from '../src/engine/teacher-command-dispatch.js';

test('学生端教师命令清单的每个 action 都能走显式 handler', async () => {
  assert.equal(STUDENT_TEACHER_COMMAND_ACTIONS.length, 19);
  const calls = [];
  const handlers = Object.fromEntries(STUDENT_TEACHER_COMMAND_ACTIONS.map((action) => [
    action,
    async (command) => calls.push(command.action),
  ]));

  for (const action of STUDENT_TEACHER_COMMAND_ACTIONS) {
    const result = await dispatchTeacherCommand({ id: `cmd-${action}`, action }, handlers);
    assert.equal(result.handled, true, action);
    assert.equal(result.action, action);
  }
  assert.deepEqual(calls, STUDENT_TEACHER_COMMAND_ACTIONS);
});

test('未知、缺 handler、显式拒绝和应用异常均返回失败结果', async () => {
  const unknown = await dispatchTeacherCommand({ action: 'future_action' }, {});
  assert.equal(unknown.handled, false);
  assert.equal(unknown.code, 'TEACHER_COMMAND_UNSUPPORTED');

  const missing = await dispatchTeacherCommand({ action: 'send_notice' }, {});
  assert.equal(missing.handled, false);
  assert.equal(missing.code, 'TEACHER_COMMAND_HANDLER_MISSING');

  const refused = await dispatchTeacherCommand({ action: 'switch_alternative' }, {
    switch_alternative: () => ({ handled: false, code: 'NO_ALTERNATIVE', message: '无替代任务' }),
  });
  assert.equal(refused.handled, false);
  assert.equal(refused.code, 'NO_ALTERNATIVE');

  const thrown = await dispatchTeacherCommand({ action: 'advance_phase' }, {
    advance_phase: () => { throw Object.assign(new Error('阶段无效'), { code: 'BAD_PHASE' }); },
  });
  assert.equal(thrown.handled, false);
  assert.equal(thrown.code, 'BAD_PHASE');
});

test('实际学生端 dispatcher 穷举 action，成功与失败使用不同回执', () => {
  const controllerPath = fileURLToPath(new URL('../src/app-controller.js', import.meta.url));
  const source = fs.readFileSync(controllerPath, 'utf8');
  const handlerBlock = source.match(/function teacherCommandHandlers\(roleState\) \{[\s\S]+?\n\}/u)?.[0] || '';
  for (const action of STUDENT_TEACHER_COMMAND_ACTIONS) {
    assert.match(handlerBlock, new RegExp(`\\b${action}:`), action);
  }
  assert.match(source, /result\.handled \? 'delivered' : 'failed'/u);
  assert.match(source, /if \(!sessionId \|\| document\.hidden \|\| teacherPollInFlight\) return;/u);
  assert.match(source, /TEACHER_AGENT_COMMAND_ACTIONS\.has\(command\.action\)[\s\S]+state\.agentBusy \|\| teacherRunBlocksLearning\(\)/u);
  assert.match(source, /const result = await getTeacherCommands\(sessionId, 0\)/u);
});

test('暂停、集合和结束保持锁定，角色切换重新激活权威会话', () => {
  const controllerPath = fileURLToPath(new URL('../src/app-controller.js', import.meta.url));
  const source = fs.readFileSync(controllerPath, 'utf8');
  assert.match(source, /function teacherRunBlocksLearning\(\)[\s\S]+teacherRunPaused[\s\S]+teacherEmergencyRally[\s\S]+teacherRunStatus === 'completed'/u);
  assert.match(source, /const persistent = \['pause', 'emergency_rally', 'end_run'\]\.includes/u);
  assert.match(source, /if \(persistent\) \{\s*showTeacherDirective\(command\)/u);
  assert.match(source, /if \(teacherRunBlocksLearning\(\)\) \{\s*if \(!passive\) showToast/u);
  assert.match(source, /await activateAgentSession\(roleState\.agentSessionId\)/u);
  assert.match(source, /if \(state\.phaseStartBusy\)/u);
  assert.match(source, /if \(state\.agentBusy \|\| state\.qaForceBusy \|\| state\.roleSelectionBusy\)/u);
});
