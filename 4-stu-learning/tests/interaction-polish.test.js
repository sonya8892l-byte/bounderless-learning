import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isAuditOnlyTransportEvent,
  PHASE_TRANSITION_DELAY_MS,
  republishActiveTaskMessage,
  shouldSuppressPassivePresentation,
  visibleEventDelay,
} from '../src/engine/presentation-timing.js';
import {
  appendPhotoBatch,
  completePhotoBatch,
  removePhotoAt,
  rollbackPhotoBatch,
} from '../src/engine/photo-evidence.js';
import {
  renderCompletedPhotoEditors,
  renderActivityTools,
  serializableToolValues,
  validateActivityStep,
  validateCompletedTaskSteps,
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

test('前端优先使用服务端 TurnPlan 的揭示间隔', () => {
  const event = {
    type: 'assistant.completed',
    data: { presentation: { delayMs: 1_250 } },
  };
  assert.equal(visibleEventDelay(event, { visibleEventCount: 1 }), 1_250);
  assert.equal(
    visibleEventDelay(event, { visibleEventCount: 0, initialEmpty: true }),
    350,
    '首条仍保留本地初次入场停顿',
  );
});

test('Step 提示后移动同一张活动任务卡到消息末尾，并保留卡片状态', () => {
  const taskMessage = {
    id: 'task-card-1',
    type: 'task',
    status: 'active',
    callId: 'call-1',
    payload: { taskId: 'task-1', taskIndex: 0 },
  };
  const messages = [
    taskMessage,
    { id: 'reply-1', type: 'assistant', text: '还要补一个远景。' },
    { id: 'reply-2', type: 'assistant', text: '请回到任务卡继续拍摄。' },
  ];

  const moved = republishActiveTaskMessage(messages, 'task-1');

  assert.equal(moved, taskMessage);
  assert.deepEqual(messages.map((message) => message.id), ['reply-1', 'reply-2', 'task-card-1']);
  assert.equal(messages.filter((message) => message === taskMessage).length, 1);
  assert.equal(taskMessage.callId, 'call-1');
  assert.equal(taskMessage.payload.taskIndex, 0);
  assert.equal(republishActiveTaskMessage(messages, 'other-task'), null);
});

test('完整已批准 delta 只用于传输审计，页面等 TurnPlan 再逐泡揭示', () => {
  assert.equal(isAuditOnlyTransportEvent({ type: 'assistant.delta' }), true);
  assert.equal(isAuditOnlyTransportEvent({ type: 'assistant.completed' }), false);
});

test('学生在被动提醒返回前恢复操作时，丢弃过时话术但保留权威状态', () => {
  const context = {
    passive: true,
    requestLastLocalActionAt: 100,
    currentLastLocalActionAt: 200,
    pageHidden: false,
  };
  assert.equal(shouldSuppressPassivePresentation({ type: 'assistant.completed' }, context), true);
  assert.equal(shouldSuppressPassivePresentation({ type: 'tool.requested' }, context), true);
  assert.equal(shouldSuppressPassivePresentation({ type: 'state.updated' }, context), false);
  assert.equal(shouldSuppressPassivePresentation(
    { type: 'assistant.completed' },
    { ...context, passive: false },
  ), false);
});

test('页面在提醒返回前转入后台时不再弹出提醒', () => {
  assert.equal(shouldSuppressPassivePresentation({ type: 'assistant.completed' }, {
    passive: true,
    requestLastLocalActionAt: 100,
    currentLastLocalActionAt: 100,
    pageHidden: true,
  }), true);
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
  assert.equal(value.revision, 1);
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
  assert.equal(value.revision, 1);
  assert.equal(value.assetIds.length, 2);
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

test('小步全部完成后，整包提交区仍能删除、重拍和补拍原 Step 照片', () => {
  const photo = { id: 'photo', name: '拍照采集', module: 'A01', config: { minCount: 1 } };
  const evidence = {
    imageUrls: ['blob:one'],
    files: [{}],
    toolValues: {
      'photo-step': {
        photo: {
          imageUrls: ['blob:one'], files: [{}], dataUrls: ['data:one'], count: 1,
        },
      },
    },
  };
  const html = renderCompletedPhotoEditors({
    steps: [{ id: 'text-step', tools: [{ id: 'text' }] }, { id: 'photo-step', tools: [photo] }],
    evidence,
    taskId: 'task',
  });
  assert.match(html, /data-tool-step="photo-step"/);
  assert.match(html, /data-action="remove-photo"/);
  assert.match(html, /data-action="complete-activity-step"/);
  assert.match(html, /保存并重新检查这一步/);
  assert.match(html, /继续拍摄（已选 1 张）/);
});

test('照片重验期间锁定增删与重复提交，避免检查中途换图造成竞态', () => {
  const photo = { id: 'photo', name: '拍照采集', module: 'A01', config: { minCount: 1 } };
  const evidence = {
    imageUrls: ['blob:one'],
    files: [{}],
    toolValues: {
      step: {
        photo: {
          imageUrls: ['blob:one'], files: [{}], dataUrls: ['data:one'], count: 1,
          revision: 2, acceptedRevision: 1, revisionSubmitting: true,
        },
      },
    },
  };
  const html = renderCompletedPhotoEditors({
    steps: [{ id: 'step', tools: [photo] }], evidence, taskId: 'task',
  });
  assert.match(html, /正在检查当前照片/);
  assert.match(html, /正在重新检查/);
  assert.match(html, /data-action="remove-photo"[\s\S]*disabled/);
  assert.match(html, /data-action="complete-activity-step"[\s\S]*disabled/);
});

test('照片版本与资产身份会进入服务端值，纯本地验收标记不会污染证据指纹', () => {
  const serialized = serializableToolValues({
    toolValues: {
      step: {
        photo: {
          count: 1,
          revision: 3,
          assetIds: ['asset-1'],
          acceptedRevision: 3,
          imageUrls: ['blob:one'],
          dataUrls: ['data:one'],
        },
      },
    },
  });
  assert.deepEqual(serialized, {
    step: { photo: { count: 1, revision: 3, assetIds: ['asset-1'] } },
  });
});

test('整包前端预检逐 Step 校验，其他 Step 的照片不能补足当前 Step', () => {
  const photo = { id: 'photo', config: { minCount: 1, maxCount: 2 } };
  const task = {
    steps: [
      { id: 'step-a', studentAction: '拍 A', completionMode: 'ai_evaluation', tools: [photo] },
      { id: 'step-b', studentAction: '拍 B', completionMode: 'ai_evaluation', tools: [photo] },
    ],
  };
  const evidence = {
    imageUrls: ['blob:b1', 'blob:b2'],
    toolValues: {
      'step-a': { photo: { count: 0, revision: 2, acceptedRevision: 1 } },
      'step-b': { photo: { count: 2, revision: 2, acceptedRevision: 2 } },
    },
  };
  const result = validateCompletedTaskSteps({ task, evidence });
  assert.equal(result.stepId, 'step-a');
  assert.match(result.message, /第 1 步[\s\S]*还需要拍摄 1 张照片/);
});

test('视频源缺失时只展示预览图，并禁止把预览伪装成已看完', () => {
  const tools = [{
    id: 'media',
    name: '沉浸媒体',
    module: 'A06',
    config: {
      type: 'video',
      title: '暴雨将至',
      poster: 'lessons/lesson_gewu_001/assets/videos/video-storm-coming.png',
      requireCompletion: true,
    },
  }];
  const html = renderActivityTools({
    tools,
    evidence: { toolValues: {} },
    taskId: 'phase-1-task-1',
    stepId: 'phase-1-task-1-step-1',
  });

  assert.match(html, /video-storm-coming\.png/);
  assert.match(html, /课程视频待补充，目前展示预览图/);
  assert.match(html, /素材未配置，暂不能完成/);
  assert.match(html, /data-action="complete-media"[^>]*disabled/);
  assert.doesNotMatch(html, /<video/);
  assert.equal(
    validateActivityStep({ tools, evidence: { toolValues: {} }, stepId: 'phase-1-task-1-step-1' }),
    '课程素材尚未配置，请联系老师。',
  );
});

test('显式 posterOnly 视频按情境图呈现并允许确认查看', () => {
  const tools = [{
    id: 'media',
    name: '沉浸媒体',
    module: 'A06',
    config: {
      type: 'video',
      title: '暴雨将至',
      poster: 'lessons/lesson_gewu_001/assets/videos/video-storm-coming.png',
      posterOnly: true,
      requireCompletion: true,
    },
  }];
  const emptyEvidence = { toolValues: {} };
  const html = renderActivityTools({
    tools,
    evidence: emptyEvidence,
    taskId: 'phase-1-task-1',
    stepId: 'phase-1-task-1-step-1',
  });

  assert.match(html, /本课程以情境预览图呈现，不含视频播放/);
  assert.match(html, /我已查看情境图/);
  assert.doesNotMatch(html, /我已看完/);
  assert.doesNotMatch(html, /<video/);
  const completeButton = html.match(/<button[^>]*data-action="complete-media"[^>]*>/)?.[0] || '';
  assert.ok(completeButton);
  assert.doesNotMatch(completeButton, /disabled/);
  assert.equal(
    validateActivityStep({ tools, evidence: emptyEvidence, stepId: 'phase-1-task-1-step-1' }),
    '请先查看课程情境图。',
  );
  assert.equal(
    validateActivityStep({
      tools,
      evidence: {
        toolValues: { 'phase-1-task-1-step-1': { media: { completed: true } } },
      },
      stepId: 'phase-1-task-1-step-1',
    }),
    '',
  );
});

test('教师开放角色命令有真实分支，忙碌时不提前领取并回执', () => {
  const controllerPath = fileURLToPath(new URL('../src/app-controller.js', import.meta.url));
  const source = fs.readFileSync(controllerPath, 'utf8');
  assert.match(source, /release_roles: \(\) => releaseRoleAssignment\(\)/u);
  assert.match(source, /lock_roles: \(\) => lockRoleAssignment\(\)/u);
  assert.match(source, /result\.handled \? 'delivered' : 'failed'/u);
  assert.match(source, /if \(!sessionId \|\| document\.hidden \|\| teacherPollInFlight\) return;/u);
  assert.match(source, /synchronizeTeacherRunState\(result\.runState\)/u);
  assert.match(source, /TEACHER_AGENT_COMMAND_ACTIONS\.has\(command\.action\)/u);
});

test('教师指令回执默认收起、可展开最近历史且保持文字可读', () => {
  const teacherDirectory = fileURLToPath(new URL('../../4-tea-leading/', import.meta.url));
  const app = fs.readFileSync(path.join(teacherDirectory, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(teacherDirectory, 'index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(teacherDirectory, 'styles.css'), 'utf8');

  assert.match(app, /commandFeedExpanded:\s*false/u);
  assert.match(app, /data-action="toggle-command-feed"/u);
  assert.match(app, /aria-controls="commandFeedHistory"/u);
  assert.match(app, /toggle\.setAttribute\('aria-expanded', String\(expanded\)\)/u);
  assert.match(app, /history\.hidden = !expanded/u);
  assert.match(app, /const commands = allCommands\.slice\(0, 8\)/u);
  assert.match(app, /summaryText\.textContent = `\$\{ACTION_LABELS\[latest\.action\]/u);
  assert.match(app, /if \(action === 'toggle-command-feed'\)/u);
  assert.match(app, /if \(action === 'open-command'\)/u);
  assert.match(app, /if \(action === 'reset-learning'\)/u);

  assert.match(html, /data-action="open-controls">教学遥控器</u);
  assert.match(styles, /\.command-feed\s*\{[^}]*color:\s*var\(--ink\)/su);
  assert.match(styles, /\.command-card\s*\{[^}]*color:\s*var\(--ink\)/su);
  assert.match(styles, /\.command-feed__list\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto/su);
  assert.match(styles, /\.command-card__top\s*\{[^}]*flex-wrap:\s*wrap/su);
});

test('学生专属入课凭证同时用于会话恢复和两种会话创建路径', () => {
  const controllerPath = fileURLToPath(new URL('../src/app-controller.js', import.meta.url));
  const source = fs.readFileSync(controllerPath, 'utf8');
  const credentialForwarding = source.match(/joinCredential: learnerJoinCredential \|\| undefined/gu) || [];
  assert.equal(credentialForwarding.length, 3);
  assert.doesNotMatch(source, /pageParams\.get\('joinCredential'\)/u);
});

test('学生密符只展示个人收藏，集齐后由教师核对推进', () => {
  const controllerPath = fileURLToPath(new URL('../src/app-controller.js', import.meta.url));
  const controller = fs.readFileSync(controllerPath, 'utf8');
  const teacherPath = fileURLToPath(new URL('../../4-tea-leading/app.js', import.meta.url));
  const teacher = fs.readFileSync(teacherPath, 'utf8');

  assert.doesNotMatch(controller, /mockTeamProgress/u);
  assert.doesNotMatch(controller, /已同步到小组|将解锁/u);
  assert.match(controller, /个人[^。]*密符|个人\$\{escapeHtml\(itemName\)\}/u);
  assert.match(controller, /老师会核对全组进度并组织进入/u);
  assert.match(teacher, /collectionReady/u);
  assert.match(teacher, /请核对小组当前阶段的证据与拼合结果/u);
  assert.match(teacher, /阶段不会自动改变/u);
});

test('Map 图标不覆盖浏览器原生 Map 构造器', () => {
  const controllerPath = fileURLToPath(new URL('../src/app-controller.js', import.meta.url));
  const source = fs.readFileSync(controllerPath, 'utf8');

  assert.match(source, /Map as MapIcon/u);
  assert.match(source, /Map:\s*MapIcon/u);
  assert.match(source, /teacherCommandApplications:\s*new Map\(\)/u);
  assert.doesNotMatch(source, /^\s*Map,\s*$/mu);
});
