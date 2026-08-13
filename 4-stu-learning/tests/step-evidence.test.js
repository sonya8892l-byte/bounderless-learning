import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acceptStepEvidence,
  acceptedStepEvidence,
  recordStepRevision,
  stepEvidenceFingerprint,
} from '../server/agent/step-evidence.js';

test('Step 指纹不受对象键顺序影响，同数量换图的版本或资产身份会改变指纹', () => {
  const first = stepEvidenceFingerprint({
    step: { photo: { count: 1, revision: 1, assetIds: ['asset-a'] }, text: { fields: { b: '2', a: '1' } } },
  }, 'step');
  const reordered = stepEvidenceFingerprint({
    step: { text: { fields: { a: '1', b: '2' } }, photo: { assetIds: ['asset-a'], revision: 1, count: 1 } },
  }, 'step');
  const replaced = stepEvidenceFingerprint({
    step: { photo: { count: 1, revision: 2, assetIds: ['asset-b'] }, text: { fields: { a: '1', b: '2' } } },
  }, 'step');

  assert.equal(first, reordered);
  assert.notEqual(first, replaced);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test('通过指纹和 revision 审计保存在任务状态，历史有界且可读取', () => {
  const session = { taskState: {} };
  acceptStepEvidence(session, {
    stepId: 'step-a', fingerprint: 'abc', source: 'ai_evaluation', acceptedAt: '2026-08-11T00:00:00.000Z',
  });
  assert.deepEqual(acceptedStepEvidence(session, 'step-a'), {
    fingerprint: 'abc', source: 'ai_evaluation', acceptedAt: '2026-08-11T00:00:00.000Z',
  });

  for (let index = 0; index < 32; index += 1) {
    recordStepRevision(session, {
      revisionId: `revision-${index}`,
      stepId: 'step-a',
      previousFingerprint: 'abc',
      currentFingerprint: `next-${index}`,
      changed: true,
      passed: index % 2 === 0,
      revisedAt: '2026-08-11T00:00:00.000Z',
    });
  }
  assert.equal(session.taskState.stepRevisionHistory.length, 30);
  assert.equal(session.taskState.stepRevisionHistory[0].revisionId, 'revision-2');
  assert.equal(session.taskState.lastStepRevision.revisionId, 'revision-31');
});
