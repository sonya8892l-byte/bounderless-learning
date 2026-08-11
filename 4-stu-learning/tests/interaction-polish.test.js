import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PHASE_TRANSITION_DELAY_MS,
  visibleEventDelay,
} from '../src/engine/presentation-timing.js';
import {
  appendPhotoBatch,
  completePhotoBatch,
  removePhotoAt,
  rollbackPhotoBatch,
} from '../src/engine/photo-evidence.js';
import {
  renderActivityTools,
  validateActivityStep,
} from '../src/components/activity-tools.js';

test('阶段提示逐条出现，工具卡在上一条提示后等待两秒', () => {
  const events = [
    { type: 'stage.started' },
    { type: 'assistant.completed' },
    { type: 'tool.requested' },
  ];
  const delays = events.map((event, visibleEventCount) => visibleEventDelay(event, {
    visibleEventCount,
    initialEmpty: true,
  }));
  assert.deepEqual(delays, [350, 900, 2_000]);
  assert.ok(PHASE_TRANSITION_DELAY_MS >= 2_000, '最终反馈需要读完后再进入角色选择页');
});

test('照片可按小步精确删除，不影响扫码图和其他小步', () => {
  const scanFile = { name: 'scan.jpg' };
  const firstFile = { name: 'first.jpg' };
  const otherStepFile = { name: 'other.jpg' };
  const evidence = {
    imageUrls: ['blob:scan', 'blob:first', 'blob:other'],
    files: [scanFile, firstFile, otherStepFile],
  };
  const value = {
    imageUrls: ['blob:first'],
    files: [firstFile],
    dataUrls: ['data:image/jpeg;base64,FIRST'],
    count: 1,
    processing: false,
  };
  const revoked = [];

  assert.equal(removePhotoAt(evidence, value, 0, { revokeObjectUrl: (url) => revoked.push(url) }), true);
  assert.deepEqual(evidence.imageUrls, ['blob:scan', 'blob:other']);
  assert.deepEqual(evidence.files, [scanFile, otherStepFile]);
  assert.deepEqual(value.imageUrls, []);
  assert.deepEqual(value.files, []);
  assert.deepEqual(value.dataUrls, []);
  assert.equal(value.count, 0);
  assert.deepEqual(revoked, ['blob:first']);
});

test('照片处理期间禁止删除；失败批次完整回滚，随后可以重拍', () => {
  const existingFile = { name: 'existing.jpg' };
  const newFile = { name: 'new.jpg' };
  const evidence = { imageUrls: ['blob:existing'], files: [existingFile] };
  const value = {
    imageUrls: ['blob:existing'], files: [existingFile], dataUrls: ['data:existing'], count: 1,
  };
  const batch = appendPhotoBatch(evidence, value, [newFile], ['blob:new']);
  assert.equal(removePhotoAt(evidence, value, 0), false);

  const revoked = [];
  rollbackPhotoBatch(evidence, value, batch, { revokeObjectUrl: (url) => revoked.push(url) });
  assert.deepEqual(evidence.imageUrls, ['blob:existing']);
  assert.deepEqual(value.imageUrls, ['blob:existing']);
  assert.deepEqual(value.dataUrls, ['data:existing']);
  assert.equal(value.processing, false);
  assert.deepEqual(revoked, ['blob:new']);

  const retryBatch = appendPhotoBatch(evidence, value, [newFile], ['blob:retry']);
  completePhotoBatch(value, ['data:retry']);
  assert.equal(retryBatch.imageUrls[0], 'blob:retry');
  assert.equal(value.count, 2);
  assert.deepEqual(value.dataUrls, ['data:existing', 'data:retry']);
});

test('照片缩略图提供可访问的删除入口，删后重新触发最低数量校验', () => {
  const evidence = {
    imageUrls: ['blob:one'],
    files: [{}],
    toolValues: {
      step: {
        photo: {
          imageUrls: ['blob:one'],
          files: [{}],
          dataUrls: ['data:one'],
          count: 1,
          processing: false,
        },
      },
    },
  };
  const tools = [{ id: 'photo', name: '拍照采集', module: 'A01', config: { minCount: 2, maxCount: 3 } }];
  const html = renderActivityTools({ tools, evidence, taskId: 'task', stepId: 'step' });
  assert.match(html, /data-action="remove-photo"/);
  assert.match(html, /aria-label="删除第 1 张照片"/);
  assert.equal(validateActivityStep({ tools, evidence, stepId: 'step' }), '还需要拍摄 1 张照片。');
});
