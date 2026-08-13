import assert from 'node:assert/strict';
import test from 'node:test';
import { studentDialogueHistory } from '../server/services/student-dialogue-history.js';
import {
  restoredDialogueMessages,
  restoredTrackRuntime,
} from '../src/engine/session-dialogue-history.js';

test('学生对话投影恢复旧对话，并过滤内部生命周期、工具和隐藏消息', () => {
  const history = studentDialogueHistory({
    messages: [
      { role: 'user', content: '我看到了汉白玉纹理。', createdAt: '2026-08-13T02:00:00.000Z' },
      { role: 'assistant', content: '把纹理最清楚的部分拍下来。', createdAt: '2026-08-13T02:00:01.000Z' },
      { role: 'user', content: 'role_assigned dragon-counter' },
      { role: 'user', content: 'tool_result 拍摄证据' },
      { role: 'user', content: '这是一条新版本内部消息', inputType: 'lifecycle_event', studentVisible: false },
      {
        id: 'student-quick-reply',
        role: 'user',
        content: '我拍好了',
        inputType: 'quick_reply',
        studentVisible: true,
      },
      {
        id: 'assistant-source',
        role: 'assistant',
        content: '照片已经收到。',
        studentVisible: true,
        sourceLabel: '[课程知识库｜排水构件]',
      },
      { role: 'assistant', content: '隐藏回复', studentVisible: false },
      { role: 'system', content: '系统 Prompt' },
      { role: 'user', content: '   ' },
    ],
  });

  assert.deepEqual(history.map(({ id, role, text, source }) => ({ id, role, text, source })), [
    { id: 'dialogue-0', role: 'user', text: '我看到了汉白玉纹理。', source: '' },
    { id: 'dialogue-1', role: 'assistant', text: '把纹理最清楚的部分拍下来。', source: '' },
    { id: 'student-quick-reply', role: 'user', text: '我拍好了', source: '' },
    { id: 'assistant-source', role: 'assistant', text: '照片已经收到。', source: '[课程知识库｜排水构件]' },
  ]);
});

test('学生对话投影只返回最近的有界纯文本记录', () => {
  const messages = Array.from({ length: 205 }, (_, index) => ({
    role: index % 2 ? 'assistant' : 'user',
    content: `消息-${index}`,
  }));
  const history = studentDialogueHistory({ messages });
  assert.equal(history.length, 200);
  assert.equal(history[0].text, '消息-5');
  assert.equal(history.at(-1).text, '消息-204');

  const bounded = studentDialogueHistory({
    messages: [{ role: 'user', content: 'a'.repeat(50) }],
  }, { maxTextLength: 12, maxTotalLength: 12 });
  assert.equal(bounded[0].text, 'a'.repeat(12));
});

test('恢复映射保持双方消息顺序，并拒绝非文本与未知角色', () => {
  const messages = restoredDialogueMessages([
    { id: 'u-1', role: 'user', text: '<img src=x onerror=alert(1)>', createdAt: '2026-08-13T03:00:00.000Z' },
    { id: 'a-1', role: 'assistant', text: '已记录。', source: '本次课程记录' },
    { id: 'system-1', role: 'system', text: '不可见' },
    { id: 'bad-1', role: 'user', text: { private: true } },
  ]);

  assert.deepEqual(messages, [
    {
      id: 'u-1',
      type: 'user',
      text: '<img src=x onerror=alert(1)>',
      source: '',
      createdAt: '2026-08-13T03:00:00.000Z',
    },
    {
      id: 'a-1',
      type: 'assistant',
      text: '已记录。',
      source: '本次课程记录',
      createdAt: null,
    },
  ]);
  assert.deepEqual(restoredDialogueMessages(null), []);
});

test('恢复运行态带回当前工具、等待推进，并识别全部完成', () => {
  const active = restoredTrackRuntime({
    completedTaskIds: ['role:task-1'],
    pendingAdvance: { mode: 'student', taskId: 'task-2', completedId: 'private-field' },
    activeTool: {
      callId: 'call-task-2',
      name: 'open_task_tool',
      payload: { taskId: 'task-2', taskIndex: 1, renderer: 'form' },
    },
  }, 3);
  assert.equal(active.completed, false);
  assert.deepEqual(active.pendingAdvance, { mode: 'student', taskId: 'task-2' });
  assert.equal(active.activeTool.callId, 'call-task-2');
  assert.equal(active.activeTool.taskId, 'task-2');

  const completed = restoredTrackRuntime({
    completedTaskIds: ['role:task-1', 'role:task-2', 'role:task-3'],
    pendingAdvance: { mode: 'invalid', taskId: 'task-3' },
    activeTool: null,
  }, 3);
  assert.equal(completed.completed, true);
  assert.equal(completed.pendingAdvance, null);
  assert.equal(completed.activeTool, null);
});
