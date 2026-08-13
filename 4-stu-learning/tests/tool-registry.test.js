import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVITY_TOOL_CATALOG,
  isPosterOnlyMedia,
  parseToolParameters,
  resolveActivityTools,
} from '../src/engine/tool-registry.js';
import { serializableToolValues, validateActivityStep } from '../src/components/activity-tools.js';

test('A01-A07 注册为十种稳定的课程活动工具', () => {
  assert.deepEqual(
    ACTIVITY_TOOL_CATALOG.map((tool) => tool.id),
    ['photo', 'audio', 'text', 'sketch', 'quiz', 'builder', 'simulation', 'team', 'media', 'scanner'],
  );
});

test('组合模块不会再被压缩为单一 renderer', () => {
  const tools = resolveActivityTools(
    'A01(拍照采集/语音/文字/画板), A02(排序答题), A03(证据墙), A04(沙盘推演), A05(组内讨论), A06(沉浸媒体), A07(扫码)',
  );
  assert.deepEqual(
    tools.map((tool) => tool.id),
    ['photo', 'audio', 'text', 'sketch', 'quiz', 'builder', 'simulation', 'team', 'media', 'scanner'],
  );
  assert.equal(tools.find((tool) => tool.id === 'quiz').config.type, 'ordering');
  assert.equal(tools.find((tool) => tool.id === 'builder').config.mode, 'evidence-wall');
});

test('课程可以用 JSON 为每种工具注入内容和参数', () => {
  const parameters = parseToolParameters('{"photo":{"minCount":2},"text":{"fields":[{"id":"source","label":"来源","required":true}]}}');
  const tools = resolveActivityTools('A01(拍照/文字)', parameters);
  assert.equal(tools.find((tool) => tool.id === 'photo').config.minCount, 2);
  assert.equal(tools.find((tool) => tool.id === 'text').config.fields[0].id, 'source');
});

test('静态视频占位必须显式声明 posterOnly 并提供 poster', () => {
  assert.equal(isPosterOnlyMedia({
    type: 'video', url: '', poster: 'opening.png', posterOnly: true,
  }), true);
  assert.equal(isPosterOnlyMedia({
    type: 'video', url: '', poster: '', posterOnly: true,
  }), false);
  assert.equal(isPosterOnlyMedia({
    type: 'audio', url: '', poster: 'opening.png', posterOnly: true,
  }), false);
  assert.equal(isPosterOnlyMedia({
    type: 'video', url: '', poster: 'opening.png', posterOnly: 'true',
  }), false);
  assert.equal(isPosterOnlyMedia({
    type: 'video', url: 'opening.mp4', poster: 'opening.png', posterOnly: true,
  }), false);
});

test('语音记录只生成录音工具，不附加默认文字必填项', () => {
  assert.deepEqual(resolveActivityTools('A01(语音记录)').map((tool) => tool.id), ['audio']);
});

test('照片按当前小步计数，其他小步的图片不能代替本步采集', () => {
  const evidence = {
    imageUrls: ['task-1.jpg', 'task-2.jpg', 'task-3.jpg'],
    toolValues: { stepA: { photo: { count: 1, imageUrls: ['step-a.jpg'] } } },
  };
  const error = validateActivityStep({
    tools: [{ id: 'photo', config: { minCount: 2 } }],
    evidence,
    stepId: 'stepA',
  });
  assert.match(error, /还需要拍摄 1 张/);
});

test('提交给服务端的工具值会移除本地媒体对象和预览地址', () => {
  const values = serializableToolValues({
    toolValues: {
      stepA: {
        photo: { count: 2, imageUrls: ['blob:photo'] },
        audio: { durationSeconds: 8, blob: { local: true }, url: 'blob:audio' },
        scanner: { captured: true, previewUrl: 'blob:scan' },
      },
    },
  });
  assert.equal(values.stepA.photo.count, 2);
  assert.equal(values.stepA.audio.durationSeconds, 8);
  assert.equal(values.stepA.scanner.captured, true);
  assert.equal(JSON.stringify(values).includes('blob:'), false);
});
