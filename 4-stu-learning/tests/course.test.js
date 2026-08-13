import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compileCourse, clearCourseCache } from '../server/course/compiler.js';
import { findSpoiler, retrieveKnowledge, restrictionUnlocked } from '../server/course/retrieval.js';
import { parseLesson } from '../src/engine/lesson-parser.js';
import { PLATFORM_COMPANION } from '../src/engine/platform-config.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

test('全部课程编译结果默认开启双学习视图，并保持严格顺序闯关', async () => {
  const courseIds = (await fs.readdir(lessonsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('lesson_'))
    .map((entry) => entry.name);
  for (const courseId of courseIds) {
    const course = await compileCourse({ lessonsRoot, courseId });
    assert.deepEqual(course.lesson.learningView, {
      enabled: true,
      default: 'dialogue',
      allowStudentSwitch: true,
    });
  }
});

test('课程编译器生成六角色、知识、限制和工具实例', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  assert.equal(course.roles.length, 6);
  assert.equal(course.knowledge.length, 19);
  assert.equal(course.roles.flatMap((role) => role.tools).length, 18);
  assert.ok(course.restrictions.length >= 9);
  assert.deepEqual(course.lesson.learningView, {
    enabled: true,
    default: 'dialogue',
    allowStudentSwitch: true,
  });
  for (const role of course.roles) {
    for (const task of role.tasks) {
      assert.ok(task.location && typeof task.location.mode === 'string');
      assert.ok(task.timing && Number.isFinite(task.timing.idleNudgeSeconds));
      assert.ok(task.nudgePolicy && Number.isFinite(task.nudgePolicy.maxNudges));
      assert.ok(['ai_suggest', 'auto_after_validation', 'teacher'].includes(task.advanceMode));
    }
  }
});

test('未解锁知识会脱敏，完成任务后才可出现精确值', async () => {
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const role = course.roles.find((item) => item.id === 'dragon-counter');
  const session = { roleId: role.id, phaseNumber: 2, completedTaskIds: [], events: [] };
  const locked = retrieveKnowledge({ course, role, session, query: '螭首数量' });
  assert.equal(locked.some((entry) => entry.content.includes('1142')), false);
  assert.ok(findSpoiler('精确数量是1142只', course, session));
  session.completedTaskIds.push('dragon-counter:task-2');
  const unlocked = retrieveKnowledge({ course, role, session, query: '螭首数量' });
  assert.equal(unlocked.some((entry) => entry.content.includes('1142')), true);
  assert.equal(findSpoiler('精确数量是1142只', course, session), null);
});

test('模拟结果必须在事件完成后解锁，真相反例不会对普通角色公开', async () => {
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const simulation = course.restrictions.find((item) => item.name === '暴雨模拟结果');
  assert.equal(restrictionUnlocked(simulation, { phaseNumber: 4, completedTaskIds: [], events: [] }), false);
  assert.equal(restrictionUnlocked(simulation, { phaseNumber: 4, completedTaskIds: [], events: ['xuanji-simulation:completed'] }), true);
  const role = course.roles.find((item) => item.id === 'dragon-counter');
  const entries = retrieveKnowledge({
    course,
    role,
    session: { roleId: role.id, phaseNumber: 2, completedTaskIds: [], events: [] },
    query: '2023 积水 反例',
  });
  assert.equal(entries.some((entry) => entry.id === 'K-19'), false);
});

test('第二门课程可从课程配置解析新角色、工具和角色解锁条件', async () => {
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_zhuhun_001' });
  assert.deepEqual(course.lesson.mapCenter, [116.3953, 40.0071]);
  assert.equal(course.lesson.venue, '中国共产党历史展览馆');
  assert.deepEqual(course.lesson.learningView, {
    enabled: true,
    default: 'dialogue',
    allowStudentSwitch: true,
  });
  assert.equal(course.roles.length, 5);
  assert.equal(course.knowledge.length, 21);
  assert.equal(course.roles.flatMap((role) => role.tools).length, 15);
  const steps = course.roles.flatMap((role) => role.tasks).flatMap((task) => task.steps);
  assert.equal(steps.length, 46);
  assert.equal(new Set(steps.flatMap((step) => step.tools.map((tool) => tool.id))).size, 10);
  assert.deepEqual(
    [...new Set(steps.flatMap((step) => step.tools.map((tool) => tool.id)))].sort(),
    ['audio', 'builder', 'media', 'photo', 'quiz', 'scanner', 'simulation', 'sketch', 'team', 'text'],
  );
  assert.equal(
    steps.some((step) => step.tools.some((tool) => tool.id === 'quiz' && tool.config.answer != null)),
    true,
    '服务端课程配置应保留客观题答案',
  );
  const mapBuilder = steps.find((step) => step.id === 'map-place-situation-cards').tools.find((tool) => tool.id === 'builder');
  assert.equal(mapBuilder.config.correctMapping['crossing-a'], 'inference');
  const simulations = steps.flatMap((step) => step.tools).filter((tool) => tool.id === 'simulation');
  assert.equal(simulations.length, 3);
  assert.equal(simulations.every((tool) => tool.config.allowRepeat === false), true);
  assert.equal(simulations.every((tool) => tool.config.metrics.every((metric) => Number.isFinite(metric.initial))), true);
  const teamTools = steps.flatMap((step) => step.tools).filter((tool) => tool.id === 'team');
  assert.equal(teamTools.every((tool) => tool.config.requiredRecordTypes?.length >= 2), true);
  const audioStep = steps.find((step) => step.id === 'signal-retell-command');
  assert.deepEqual(audioStep.tools.map((tool) => tool.id), ['audio']);
  const photoSteps = steps.filter((step) => step.tools.some((tool) => tool.id === 'photo'));
  assert.equal(photoSteps.every((step) => step.completionMode === 'ai_evaluation'), true);
  assert.equal(
    steps.find((step) => step.id === 'decision-build-options').studentAction.endsWith('“未知”'),
    true,
    '字段末尾的成对中文引号不得被清洗器误删',
  );
  assert.equal(
    steps.find((step) => step.id === 'signal-label-sentences').studentAction.includes('“未使用”'),
    true,
  );
  const decisionMedia = steps.find((step) => step.id === 'decision-read-new-evidence').tools[0];
  assert.match(decisionMedia.config.url, /decision-review-card\.svg$/);
  const signalMedia = steps.find((step) => step.id === 'signal-read-command').tools[0];
  assert.match(signalMedia.config.url, /limited-message\.svg$/);
  const publicToolConfig = JSON.stringify(course.roles.flatMap((role) => role.tools).map((tool) => tool.publicConfig));
  for (const privateKey of ['"answer":', '"expectedResults":', '"correctMapping":', '"retryMessage":']) {
    assert.equal(publicToolConfig.includes(privateKey), false, `公开工具配置包含 ${privateKey}`);
  }
  assert.equal(course.phasePrompts['phase-4'].includes('课程情境材料｜史料出处待核'), true);
  assert.equal(Object.hasOwn(course.lesson, 'persona'), false);
  assert.equal(PLATFORM_COMPANION.posterAsset, '/assets/images/xuxu-avatar.png');
  assert.equal(PLATFORM_COMPANION.idleAsset, '/assets/video/xuxu-idle.webm');
  assert.equal(PLATFORM_COMPANION.talkAsset, '/assets/video/xuxu-talk.webm');
  assert.equal(Object.hasOwn(course.lesson.assets, 'companionIdle'), false);
  assert.equal(Object.hasOwn(course.lesson.assets, 'companionTalk'), false);
  assert.equal(course.roles.every((role) => role.tasks.every((task) => task.location.legacyMode === 'inherit_role')), true);
  assert.equal(course.roles.every((role) => role.tasks.every((task) => ['point', 'geofence'].includes(task.location.mode))), true);

  const restriction = course.restrictions.find((item) => item.name === '一渡完整方案');
  const session = { roleId: 'map-strategist', phaseNumber: 2, completedTaskIds: [], events: [] };
  assert.equal(restrictionUnlocked(restriction, session, course), false);
  session.completedTaskIds.push('map-strategist:task-2');
  assert.equal(restrictionUnlocked(restriction, session, course), true);

  const feintRole = course.roles.find((role) => role.id === 'feint-strategist');
  const feintKnowledge = retrieveKnowledge({
    course,
    role: feintRole,
    session: { roleId: feintRole.id, phaseNumber: 2, completedTaskIds: [], events: [] },
    query: '信息盲区矩阵',
    references: 'K-14',
  });
  assert.equal(feintKnowledge.some((entry) => entry.id === 'K-14'), true);
  const signalRole = course.roles.find((role) => role.id === 'signaler');
  const signalKnowledge = retrieveKnowledge({
    course,
    role: signalRole,
    session: { roleId: signalRole.id, phaseNumber: 2, completedTaskIds: [], events: [] },
    query: '有限命令',
    references: 'K-19',
  });
  assert.equal(signalKnowledge.some((entry) => entry.id === 'K-19'), true);
});

test('普通问候不会误命中课程知识', async () => {
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const role = course.roles[0];
  const entries = retrieveKnowledge({
    course,
    role,
    session: { roleId: role.id, phaseNumber: 2, completedTaskIds: [], events: [] },
    query: '你好',
  });
  assert.deepEqual(entries, []);
});

test('知识检索按问题相关性选卡，不用共同大词硬塞无关首条', async () => {
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const dragon = course.roles.find((item) => item.id === 'dragon-counter');
  const dragonSession = {
    roleId: dragon.id,
    phaseNumber: 2,
    completedTaskIds: ['dragon-counter:task-1'],
    events: [],
  };

  const mechanism = retrieveKnowledge({
    course,
    role: dragon,
    session: dragonSession,
    query: '螭首有什么用？为什么它能排水？',
  });
  assert.equal(mechanism[0]?.id, 'K-03', '具体机制应优先命中工程功能，而非列表第一条基本信息');

  const unavailableBoundary = retrieveKnowledge({
    course,
    role: dragon,
    session: dragonSession,
    query: '故宫排水有什么局限？',
  });
  assert.deepEqual(unavailableBoundary, [], '局限卡尚未解锁时不能拿普通排水卡冒充答案');
});

test('已解锁的追问能命中对应来源卡', async () => {
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const truth = course.roles.find((item) => item.id === 'truth-seeker');
  const entries = retrieveKnowledge({
    course,
    role: truth,
    session: {
      roleId: truth.id,
      phaseNumber: 2,
      completedTaskIds: ['truth-seeker:task-2'],
      events: [],
    },
    query: '六百年真的从来没有积水吗？',
  });

  assert.equal(entries[0]?.id, 'K-19');
  assert.match(entries[0]?.source || '', /新闻报道|维修记录/);
});

test('浏览器课程包不包含课程答案和受保护值', async () => {
  const source = await fs.readFile(new URL('../src/generated/lesson-public.js', import.meta.url), 'utf8');
  for (const forbidden of [
    '"answer":',
    '"expectedResults":',
    '"correctMapping":',
    '"retryMessage":',
    '"keyData":',
    '"verify":',
    '1142',
    '52米',
    '2023年故宫局部积水',
    '1935年1月29日',
    '1935年2月18日至21日',
    '1935年3月21日至22日',
    '放弃进攻打鼓新场以及成立新的三人军事指挥小组',
    '失散小战士追赶队伍',
    '禁止建议学生攀爬、跳跃、靠近水域边缘',
    '不主动询问学生的家庭信息、联系方式、健康状况',
  ]) {
    assert.equal(source.includes(forbidden), false, `公开课程包包含 ${forbidden}`);
  }
  assert.equal(source.includes('阅读教师展示的1935年1月初始态势卡'), true, '公开课程包误删了任务所需的非受保护年份背景');
});

test('结构化角色阶段小步保留稳定ID、位置和完成方式', () => {
  const lesson = parseLesson({
    id: 'lesson_schema_v2',
    assetBase: 'lessons/lesson_schema_v2/assets',
    files: {
      'course.md': `# 测试课程
> 测试
## 基本信息
- 主题模板：zhuhun
## 学生端角色体系
- collectionName：观察员
- itemName：身份
- collectionItemName：线索
- collectionPanelName：线索板
- unlockTarget：总结
- 任务阶段：phase-2`,
      'phases.md': '## Phase 2：现场观察\n- 时长：30min',
      'time-bank.md': '',
      'roles/observer.md': `# 观察员
> 核心问题：水往哪里流？
## 基本信息
- 选择说明：观察现场水流方向
- 角色卡图：assets/roles/card.png
- 角色徽章图：assets/roles/badge.png
- 收集物：A
- 收集物图：assets/tokens/a.png
- 地点：观察点
### 角色阶段1：寻找水路
- id：find-water
- 阶段：Phase 2
- 配置：找到一条可见水路
- 位置模式：none
- 完成方式：compound
- 通过条件：完成观察并提交照片
#### Step 1：先观察
- id：observe-water
- 小步目标：发现地面高低
- 学生行动：观察地面并指出低处
- 位置：none
- 完成方式：user_confirm
- 通过后：step:photo-water
#### Step 2：再拍照
- id：photo-water
- 小步目标：记录水路
- 学生行动：拍下水路全景
- 位置：inherit
- 完成方式：tool_result
- 证据要求：照片包含起点和终点
- 功能模块：A01(camera)
- 通过后：role_stage:complete`,
    },
  });
  const roleStage = lesson.roles[0].tasks[0];
  assert.equal(roleStage.id, 'find-water');
  assert.equal(roleStage.completionMode, 'compound');
  assert.deepEqual(roleStage.guidanceSteps, ['观察地面并指出低处', '拍下水路全景']);
  assert.equal(roleStage.steps[0].id, 'observe-water');
  assert.equal(roleStage.steps[0].completionMode, 'user_confirm');
  assert.equal(roleStage.steps[0].location.mode, 'none');
  assert.equal(roleStage.steps[1].id, 'photo-water');
  assert.equal(roleStage.steps[1].completionMode, 'tool_result');
  assert.equal(roleStage.steps[1].location.mode, 'inherit');
  assert.equal(roleStage.steps[1].evidenceRequirement, '照片包含起点和终点');
});

test('课程学习视图拒绝未知默认值', () => {
  assert.throws(() => parseLesson({
    id: 'lesson_bad_view',
    assetBase: 'lessons/lesson_bad_view/assets',
    files: {
      'course.md': `# 测试课程
## 基本信息
- 主题模板：gewu
## 学生端角色体系
- collectionName：观察员
- itemName：身份
- collectionItemName：线索
- collectionPanelName：线索板
- unlockTarget：总结
- 任务阶段：phase-2
## 学习视图
- enabled：true
- default：unknown`,
      'phases.md': '',
      'time-bank.md': '',
    },
  }), /学习视图 default 无效/);
});
