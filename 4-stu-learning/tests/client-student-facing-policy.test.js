import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  containsClientUnsafeDirective,
  createClientStudentFacingPolicy,
  studentFacingApiErrorMessage,
} from '../src/engine/student-facing-policy.js';

const controllerPath = fileURLToPath(new URL('../src/app-controller.js', import.meta.url));

test('前端学生可见文本清理控制字符但完整保留长内容', () => {
  const policy = createClientStudentFacingPolicy();
  const complete = '第一段说明现场观察。第二段说明判断依据。第三段说明下一步行动。'.repeat(80);
  const output = policy.processText(`${complete}\u0000`, { channel: 'standalone' });
  assert.equal(output.text, complete);
  assert.equal(output.text.endsWith('…'), false);
  assert.ok(output.actions.includes('standalone:normalized'));
});

test('前端固定消息、教师提示和覆盖层共用危险动作门禁', () => {
  const policy = createClientStudentFacingPolicy();
  for (const text of ['请跳过护栏继续拍。', '边过马路边看手机确认路线。']) {
    const output = policy.processText(text, { channel: 'teacher' });
    assert.equal(output.text, '先不要执行这个动作。请跟随老师，在安全位置完成观察。');
    assert.ok(output.actions.includes('teacher:unsafe_action_blocked'));
  }
  assert.equal(containsClientUnsafeDirective('过马路时不要看手机，请跟随老师统一移动。'), false);
});

test('API 错误只放行已知学生业务码的安全完整文案', () => {
  const complete = '第 2 步仍缺少一张能同时看见主体、台基边缘和周围位置关系的全景照片，请补拍后再次提交。'.repeat(12);
  assert.equal(studentFacingApiErrorMessage({
    code: 'STEP_EVIDENCE_MISSING',
    status: 422,
    message: complete,
  }, '提交失败。'), complete);

  const leaked = studentFacingApiErrorMessage({
    code: 'STEP_EVIDENCE_MISSING',
    status: 500,
    message: 'PostgreSQL password=secret at query (/Users/example/server/store.js:18:4)',
  }, '提交失败。');
  assert.equal(leaked, '服务暂时没有响应，请稍后重试。');
  assert.doesNotMatch(leaked, /PostgreSQL|password|\/Users\//i);

  assert.equal(studentFacingApiErrorMessage({
    code: 'INTERNAL_FAILURE',
    status: 500,
    message: 'raw database connection refused',
  }, '提交失败。'), '服务暂时没有响应，请稍后重试。');
});

test('恢复卡、QA/上传错误、教师提示和 overlay 都接入前端统一边界', () => {
  const source = fs.readFileSync(controllerPath, 'utf8');
  assert.match(source, /function currentTaskRecoveryMessages[\s\S]*studentFacingText\(`界面已恢复/u);
  assert.match(source, /function showToast[\s\S]*studentFacingText\(message/u);
  assert.match(source, /const visibleError = studentFacingError\(error, '验收推进失败/u);
  assert.match(source, /studentFacingError\(error, '提交暂未完成/u);
  assert.match(source, /function teacherNotice[\s\S]*channel: 'teacher-notice'/u);
  assert.match(source, /function showTeacherDirective[\s\S]*channel: 'teacher-overlay'/u);
  assert.doesNotMatch(source, /showToast\(error(?:\?\.)?\.message/u);
});
