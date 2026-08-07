import { PLATFORM_LEARNING_VIEW } from './platform-config.js';
import { resolveActivityTools } from './tool-registry.js';

function clean(value = '') {
  const result = value.trim();
  const pair = [["'", "'"], ['"', '"'], ['“', '”']]
    .find(([open, close]) => result.length >= 2 && result.startsWith(open) && result.endsWith(close));
  return pair ? result.slice(1, -1).trim() : result;
}

function requiredField(value, label) {
  const result = clean(value || '');
  if (!result) throw new Error(`课程配置缺少必填字段：${label}`);
  return result;
}

function parseLooseSettings(markdown, heading) {
  const section = sectionAfter(markdown, heading);
  const result = {};

  for (const line of section.split('\n')) {
    const match = line.match(/^([a-zA-Z][\w-]*)[：:]\s*(.+)$/);
    if (match) result[match[1]] = clean(match[2]);
  }

  return result;
}

function parseBoolean(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function parseNumber(value, fallback = 0) {
  return Number.parseFloat(String(value || '').match(/-?\d+(?:\.\d+)?/)?.[0]) || fallback;
}

function parseDurationSeconds(value, fallback = 0) {
  const text = clean(value || '').toLowerCase();
  if (!text) return fallback;
  const amount = Number.parseFloat(text.match(/\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(amount)) return fallback;
  if (/小时|hour|\bhr\b/.test(text)) return Math.round(amount * 3600);
  if (/分钟|min/.test(text)) return Math.round(amount * 60);
  return Math.round(amount);
}

function parseCoordinates(value) {
  const values = String(value || '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
  return values.length >= 2 && values.slice(0, 2).every(Number.isFinite) ? values.slice(0, 2) : null;
}

function resolveAssetPath(assetBase, value, fallback = '') {
  const path = clean(value || fallback);
  if (!path) return '';
  if (/^(?:https?:|data:|blob:|\/)/.test(path)) return path;
  return `${assetBase}/${path.replace(/^assets\//, '')}`;
}

function resolveToolAssets(tools, assetBase) {
  const assetKeys = ['url', 'poster', 'backgroundImage', 'referenceImage'];
  return tools.map((tool) => ({
    ...tool,
    config: Object.fromEntries(Object.entries(tool.config || {}).map(([key, value]) => [
      key,
      assetKeys.includes(key) && value ? resolveAssetPath(assetBase, value) : value,
    ])),
  }));
}

function stripDecoration(value = '') {
  return value.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').trim();
}

function parseKeyValues(markdown, heading) {
  const section = sectionAfter(markdown, heading);
  const result = {};

  for (const line of section.split('\n')) {
    const match = line.match(/^-\s*([^：:]+)[：:]\s*(.+)$/);
    if (match) result[clean(match[1])] = clean(match[2]);
  }

  return result;
}

function sectionAfter(markdown, heading) {
  const start = markdown.indexOf(heading);
  if (start === -1) return '';
  const body = markdown.slice(start + heading.length);
  const nextHeading = body.search(/\n#{1,3}\s+/);
  return nextHeading === -1 ? body : body.slice(0, nextHeading);
}

function headingTitle(markdown) {
  return stripDecoration(markdown.match(/^#\s+(.+)$/m)?.[1] || '未命名课程');
}

function blockquote(markdown) {
  return clean(markdown.match(/^>\s*(.+)$/m)?.[1] || '');
}

function parseListValue(value = '') {
  return value
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((item) => clean(item))
    .filter(Boolean);
}

function parseGuidanceSteps(value = '', fallback = '') {
  const source = clean(value || fallback)
    .replace(/(?:^|；)\s*\d+[.、]\s*/g, '；')
    .replace(/^[；\s]+|[；\s]+$/g, '');
  if (!source) return ['先记录一条你最容易确认的现场线索'];

  let steps = source.split(/[；\n]+/).map((item) => clean(item)).filter(Boolean);
  if (steps.length === 1) {
    const sentences = source.split(/[。！？]+/).map((item) => clean(item)).filter(Boolean);
    if (sentences.length > 1) steps = sentences;
  }
  if (steps.length === 1) {
    const clauses = source.split(/[+，,]/).map((item) => clean(item)).filter(Boolean);
    if (clauses.length > 1 && clauses.length <= 5) steps = clauses;
  }
  return steps.slice(0, 5).map((item) => item.replace(/^[①-⑨\d]+[.、）)]?\s*/, '').trim());
}

function normalizeLocationMode(rawMode, hasCoordinates, hasName) {
  const value = clean(rawMode || '').toLowerCase();
  if (['none', 'point', 'geofence', 'route', 'area'].includes(value)) return value;
  if (['inherit', 'inherit_role'].includes(value)) return 'inherit';
  if (value === 'task_specific') return hasCoordinates ? 'geofence' : (hasName ? 'point' : 'none');
  if (hasCoordinates) return 'geofence';
  if (hasName) return 'point';
  return 'none';
}

function normalizeCompletionMode(value, fallback = 'tool_result') {
  const mode = clean(value || '').toLowerCase();
  return ['user_confirm', 'tool_result', 'ai_evaluation', 'teacher_confirm', 'location_event', 'compound'].includes(mode)
    ? mode
    : fallback;
}

// 字段区 = 首行标题之后、下一个标题之前。就地引导/脚手架/验收标准以标题起头，
// 不能被最后一个字段的续行吞掉。
function fieldRegion(block = '') {
  const firstLineEnd = block.indexOf('\n');
  if (firstLineEnd === -1) return block;
  const head = block.slice(0, firstLineEnd + 1);
  const rest = block.slice(firstLineEnd + 1);
  const nextHeading = rest.search(/^#{1,6}[ \t]/m);
  return nextHeading === -1 ? block : head + rest.slice(0, nextHeading);
}

const INLINE_SECTIONS = Object.freeze([
  Object.freeze({ label: '引导', key: 'guidance' }),
  Object.freeze({ label: '脚手架', key: 'scaffold' }),
  Object.freeze({ label: '验收标准', key: 'acceptance' }),
]);

// v2 任务单元：引导/脚手架/验收标准就地书写为 #### 到 ###### 级标题段。
function parseInlineSections(block = '') {
  const labels = INLINE_SECTIONS.map((section) => section.label).join('|');
  const matches = [...block.matchAll(new RegExp(`^#{4,6}[ \\t]*(${labels})[ \\t]*$`, 'gm'))];
  const result = {};
  for (const [index, match] of matches.entries()) {
    const start = match.index + match[0].length;
    const body = block.slice(start, matches[index + 1]?.index ?? block.length);
    const nextHeading = body.search(/^#{1,6}[ \t]/m);
    const key = INLINE_SECTIONS.find((section) => section.label === match[1]).key;
    result[key] = (nextHeading === -1 ? body : body.slice(0, nextHeading)).trim();
  }
  return result;
}

// 能力标签前缀：平台树 CC 核心能力 / CQ 综合素质；课程树 DK 学科知识 / DS 学科能力 /
// DC 课程级核心能力。只做数据预留——不下发浏览器、不进 Prompt、无计算。
function parseCompetencyTags(value = '') {
  const tags = String(value)
    .split(/[,，、;；\s]+/)
    .map((item) => clean(item).toUpperCase())
    .filter((item) => /^(?:CC|CQ|DK|DS|DC)-[0-9A-Z.]+$/.test(item));
  return [...new Set(tags)];
}

function parseBlockFields(block) {
  const fieldRegex = /^-\s*([^：:\n]+)[：:][ \t]*(.*)$/gm;
  const matches = [...block.matchAll(fieldRegex)];
  const fields = {};
  matches.forEach((match, matchIndex) => {
    const valueStart = match.index + match[0].length;
    const valueEnd = matches[matchIndex + 1]?.index ?? block.length;
    const continuation = block
      .slice(valueStart, valueEnd)
      .split('\n')
      .map((line) => line.replace(/^\s+-\s*/, '').trim().replace(/^-\s*/, ''))
      .filter((line) => !/^(真值|参考值|正确答案|答案|允许误差|关键数据)[：:]/.test(line))
      .filter(Boolean);
    fields[clean(match[1])] = [clean(match[2]), ...continuation].filter(Boolean).join('\n');
  });
  return fields;
}

function parseStructuredSteps(block, roleStageId, assetBase) {
  const matches = [...block.matchAll(/^####\s*(?:Step|小步)\s*(\d+)[：:]\s*(.+)$/gim)];
  return matches.map((match, index) => {
    const end = matches[index + 1]?.index ?? block.length;
    const stepBlock = block.slice(match.index, end);
    const fields = parseBlockFields(fieldRegion(stepBlock));
    const inline = parseInlineSections(stepBlock);
    const rawLocation = fields['位置'] || 'inherit';
    const coordinates = parseCoordinates(fields['坐标']);
    const locationMode = normalizeLocationMode(rawLocation, Boolean(coordinates), Boolean(fields['地点']));
    const id = clean(fields.id || fields.ID || `${roleStageId}-step-${index + 1}`);
    const modules = fields['功能模块'] || '';
    return {
      id,
      title: stripDecoration(match[2]),
      objective: fields['小步目标'] || fields['目标'] || stripDecoration(match[2]),
      studentAction: fields['学生行动'] || fields['行动'] || stripDecoration(match[2]),
      completionMode: normalizeCompletionMode(fields['完成方式'], 'user_confirm'),
      evidenceRequirement: fields['证据要求'] || '',
      location: {
        mode: locationMode,
        name: fields['地点'] || '',
        coordinates,
        radiusMeters: parseNumber(fields['围栏半径'], null),
        minDwellSeconds: parseDurationSeconds(fields['最短停留']),
        verification: clean(fields['到达验证'] || 'none').toLowerCase(),
      },
      modules,
      toolParameters: fields['工具参数'] || '',
      tools: resolveToolAssets(resolveActivityTools(modules, fields['工具参数']), assetBase),
      knowledgeRef: fields['知识引用'] || '',
      guidanceRef: fields['引导引用'] || '',
      restrictionRef: fields['限制引用'] || '',
      evaluationRef: fields['评估引用'] || '',
      scaffoldRef: fields['脚手架引用'] || '',
      guidance: inline.guidance || '',
      scaffold: inline.scaffold || '',
      acceptance: inline.acceptance || '',
      competencyTags: parseCompetencyTags(fields['能力标签']),
      commonMisconception: fields['常见误区'] || '',
      maxAttempts: Math.max(1, Math.round(parseNumber(fields['最大尝试'], 3))),
      failureHandling: fields['失败处理'] || '',
      teacherIntervention: fields['教师介入'] || '',
      next: fields['通过后'] || '',
    };
  });
}

function parseTaskBlock(block, index, assetBase) {
  const firstStepIndex = block.search(/^####\s*(?:Step|小步)\s*\d+[：:]/im);
  const roleStageBlock = firstStepIndex === -1 ? block : block.slice(0, firstStepIndex);
  const fields = parseBlockFields(fieldRegion(roleStageBlock));
  const inline = parseInlineSections(roleStageBlock);

  const modules = fields['功能模块'] || '';
  const tools = resolveToolAssets(resolveActivityTools(modules, fields['工具参数']), assetBase);
  const primaryTool = tools[0]?.id || 'text';
  const toolType = ['photo', 'scanner'].includes(primaryTool)
    ? 'capture'
    : primaryTool === 'quiz'
      ? 'form'
      : primaryTool;

  const coordinates = parseCoordinates(fields['坐标']);
  const rawLocationMode = fields['位置模式'] || (fields['地点'] ? 'task_specific' : 'none');
  const locationMode = normalizeLocationMode(rawLocationMode, Boolean(coordinates), Boolean(fields['地点']));
  const requirement = fields['配置'] || fields['通过条件'] || '提交你的现场发现';
  const id = clean(fields.id || fields.ID || `task-${index + 1}`);
  const structuredSteps = parseStructuredSteps(block, id, assetBase);
  const guidanceSteps = structuredSteps.length
    ? structuredSteps.map((step) => step.studentAction)
    : parseGuidanceSteps(fields['引导步骤'], requirement);
  const steps = structuredSteps.length ? structuredSteps : guidanceSteps.map((studentAction, stepIndex) => ({
      id: `${id}-step-${stepIndex + 1}`,
      objective: studentAction,
      studentAction,
      completionMode: 'user_confirm',
      evidenceRequirement: '',
      location: { mode: 'inherit' },
    }));
  return {
    id,
    roleStageId: id,
    name: stripDecoration(block.match(/^###\s*(?:任务|角色阶段)\d+[：:]\s*(.+)$/m)?.[1] || `任务${index + 1}`),
    phase: fields['阶段'] || '课程任务',
    modules,
    toolParameters: fields['工具参数'] || '',
    tools,
    requirement,
    guidanceSteps,
    steps,
    completionMode: normalizeCompletionMode(fields['完成方式']),
    evidenceRequirement: fields['证据要求'] || fields['通过条件'] || '完成提交',
    passCondition: fields['通过条件'] || '完成提交',
    goals: fields['目标关联'] || '',
    guide: fields['AI引导方向'] || '',
    inlineGuidance: inline.guidance || '',
    inlineScaffold: inline.scaffold || '',
    inlineAcceptance: inline.acceptance || '',
    competencyTags: parseCompetencyTags(fields['能力标签']),
    prerequisites: parseListValue(fields['前置'] || ''),
    toolType,
    image: resolveAssetPath(assetBase, fields['任务图']),
    location: {
      mode: locationMode,
      legacyMode: clean(rawLocationMode).toLowerCase(),
      name: fields['地点'] || '',
      coordinates,
      radiusMeters: parseNumber(fields['围栏半径'], null),
      geofence: fields['地理围栏'] || '',
      verification: clean(fields['到达验证'] || 'none').toLowerCase(),
      minDwellSeconds: parseDurationSeconds(fields['最短停留']),
    },
    timing: {
      suggestedSeconds: parseDurationSeconds(fields['建议时长'], 15 * 60),
      idleNudgeSeconds: parseDurationSeconds(fields['无操作提醒'], 3 * 60),
      nudgeCooldownSeconds: parseDurationSeconds(fields['提醒冷却'], 2 * 60),
    },
    nudgePolicy: {
      maxNudges: Math.max(0, Math.round(parseNumber(fields['最大主动提醒'], 2))),
    },
    advanceMode: ['ai_suggest', 'auto_after_validation', 'teacher'].includes(clean(fields['推进方式']).toLowerCase())
      ? clean(fields['推进方式']).toLowerCase()
      : 'auto_after_validation',
  };
}

function parseRole(path, markdown, assetBase, index) {
  const slug = path.split('/').at(-1).replace('.md', '');
  const info = parseKeyValues(markdown, '## 基本信息');
  const taskMatches = [...markdown.matchAll(/^###\s*(?:任务|角色阶段)\d+[：:].*$/gm)];
  const tasks = taskMatches.map((match, taskIndex) => {
    const start = match.index;
    const end = taskMatches[taskIndex + 1]?.index ?? markdown.indexOf('\n## Phase 3', start);
    return parseTaskBlock(markdown.slice(start, end === -1 ? markdown.length : end), taskIndex, assetBase);
  });

  const token = requiredField(info['收集物'], `${path} / 基本信息 / 收集物`);

  const roleLocation = info['地点'] || '课程现场';
  const roleGeofence = info['地理围栏'] || '';
  const resolvedTasks = tasks.map((task) => {
    if (task.location.mode !== 'inherit') return task;
    const inheritedCoordinates = task.location.coordinates || parseCoordinates(roleGeofence);
    return {
      ...task,
      location: {
        ...task.location,
        mode: inheritedCoordinates ? 'geofence' : 'point',
        inherited: true,
        name: task.location.name || roleLocation,
        coordinates: inheritedCoordinates,
        radiusMeters: task.location.radiusMeters || parseNumber(roleGeofence.match(/半径\s*\d+/)?.[0], null),
        geofence: task.location.geofence || roleGeofence,
      },
    };
  });

  return {
    id: slug,
    order: parseNumber(info['排序'], index + 1),
    name: headingTitle(markdown),
    question: blockquote(markdown).replace(/^核心问题[：:]\s*/, ''),
    selectionDescription: requiredField(info['选择说明'], `${path} / 基本信息 / 选择说明`),
    location: roleLocation,
    geofence: roleGeofence,
    type: info['类型'] || '核心角色',
    collectionItem: token,
    collectionItemImage: resolveAssetPath(assetBase, requiredField(info['收集物图'], `${path} / 基本信息 / 收集物图`)),
    keyData: info['关键数据'] || '',
    tasks: resolvedTasks,
    cardImage: resolveAssetPath(assetBase, requiredField(info['角色卡图'], `${path} / 基本信息 / 角色卡图`)),
    badgeImage: resolveAssetPath(assetBase, requiredField(info['角色徽章图'], `${path} / 基本信息 / 角色徽章图`)),
  };
}

function parsePhases(markdown) {
  const matches = [...markdown.matchAll(/^##\s*Phase\s*(\d+)[：:]\s*(.+)$/gm)];

  return matches.map((match, index) => {
    const start = match.index;
    const end = matches[index + 1]?.index ?? markdown.length;
    const block = markdown.slice(start, end);
    const info = {};
    for (const field of ['时长', '模式', '地点', '功能模块', '触发条件', '结束条件']) {
      info[field] = clean(block.match(new RegExp(`^-\\s*${field}[：:]\\s*(.+)$`, 'm'))?.[1] || '');
    }
    const flow = sectionAfter(block, '### 流程')
      .split('\n')
      .map((line) => line.match(/^\d+\.\s*(.+)$/)?.[1])
      .filter(Boolean);

    return {
      id: `phase-${match[1]}`,
      number: Number(match[1]),
      name: stripDecoration(match[2]),
      duration: info['时长'],
      mode: info['模式'],
      location: info['地点'],
      modules: info['功能模块'],
      trigger: info['触发条件'],
      endCondition: info['结束条件'],
      flow,
    };
  });
}

function parseTimeBank(markdown = '') {
  const base = parseLooseSettings(markdown, '## 基本设置');
  const earnRules = parseLooseSettings(markdown, '## 赚取规则');
  const giftRules = parseLooseSettings(markdown, '## 分配规则');
  const blocks = [...markdown.matchAll(/(?:^|\n)- id:[ \t]*(tb-\d+)([\s\S]*?)(?=\n- id:|\n###\s|$)/g)];
  const tasks = blocks.map((match) => {
    const block = match[2];
    const get = (field) => clean(block.match(new RegExp(`^[ \\t]+${field}:[ \\t]*["']?(.+?)["']?$`, 'm'))?.[1] || '');
    return {
      id: match[1],
      type: get('type'),
      question: get('question') || get('description'),
      options: parseListValue(get('options')),
      answer: get('answer'),
      answerType: get('answer_type'),
      hint: get('hint'),
      reward: Number.parseInt(get('reward'), 10) || 1,
      unlockAfter: get('unlock_after'),
      verify: get('verify'),
      location: parseListValue(get('location')).map(Number),
      radius: parseNumber(get('radius')),
      minLength: parseNumber(get('min_length')),
    };
  });

  return {
    enabled: parseBoolean(base.enabled, tasks.length > 0),
    initialBalance: parseNumber(base.initial_balance),
    currencyUnit: base.currency_unit || '分钟',
    earnRules: {
      maxTotal: parseNumber(earnRules.max_earn_total),
      maxPerTask: parseNumber(earnRules.max_earn_per_task),
      tasksVisibleAtOnce: parseNumber(earnRules.tasks_visible_at_once, 3),
    },
    giftRules: {
      allowGiftToSelf: parseBoolean(giftRules.allow_gift_to_self),
      maxPerAction: parseNumber(giftRules.max_gift_per_action, 1),
      minAmount: parseNumber(giftRules.min_gift_amount, 1),
      target: giftRules.gift_target || 'same_group_only',
    },
    tasks,
  };
}

export function parseLesson(source) {
  const courseMarkdown = source.files['course.md'];
  const courseInfo = parseKeyValues(courseMarkdown, '## 基本信息');
  const roleSystem = parseKeyValues(courseMarkdown, '## 学生端角色体系');
  const learningView = parseKeyValues(courseMarkdown, '## 学习视图');
  const visualAssets = parseKeyValues(courseMarkdown, '## 学生端视觉素材');
  const assetBase = source.assetBase;
  const roleFiles = Object.entries(source.files)
    .filter(([path]) => path.startsWith('roles/') && path.endsWith('.md'));
  const roles = roleFiles
    .map(([path, markdown], index) => parseRole(path, markdown, assetBase, index))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const requestedLearningView = clean(learningView.default || PLATFORM_LEARNING_VIEW.default).toLowerCase();
  if (!['dialogue', 'challenge'].includes(requestedLearningView)) {
    throw new Error(`课程配置中的学习视图 default 无效：${requestedLearningView}`);
  }

  return {
    id: source.id,
    title: headingTitle(courseMarkdown),
    subtitle: blockquote(courseMarkdown),
    series: courseInfo['系列'] || '',
    seriesCode: courseInfo['系列代码'] || '',
    themeTemplate: requiredField(courseInfo['主题模板'], 'course.md / 基本信息 / 主题模板'),
    venue: courseInfo['场地'] || '',
    mapCenter: parseCoordinates(courseInfo['坐标中心']),
    duration: courseInfo['时长'] || '',
    grades: courseInfo['适用年级'] || '',
    groupRule: courseInfo['分组'] || '',
    level: courseInfo['课程层级'] || '',
    levelCode: courseInfo['层级代码'] || '',
    // 遍历策略预留：本期执行器只实现 sequential，open/inquiry 写了暂不生效。
    traversalMode: ['sequential', 'open', 'inquiry'].includes(clean(courseInfo['遍历模式']).toLowerCase())
      ? clean(courseInfo['遍历模式']).toLowerCase()
      : 'sequential',
    coreQuestion: clean(sectionAfter(courseMarkdown, '## 核心问题').split('\n').find(Boolean) || ''),
    phases: parsePhases(source.files['phases.md']),
    roleSystem: {
      collectionName: requiredField(roleSystem.collectionName, 'course.md / 学生端角色体系 / collectionName'),
      itemName: requiredField(roleSystem.itemName, 'course.md / 学生端角色体系 / itemName'),
      pickerEyebrow: roleSystem['选择眉题'] || '{roleCount}个角色',
      pickerTitle: roleSystem['选择标题'] || '选择你的角色',
      pickerDescription: roleSystem['选择说明'] || '选择角色后开始完成本次课程任务。',
      collectionItemName: requiredField(roleSystem.collectionItemName, 'course.md / 学生端角色体系 / collectionItemName'),
      collectionPanelName: requiredField(roleSystem.collectionPanelName, 'course.md / 学生端角色体系 / collectionPanelName'),
      unlockTarget: requiredField(roleSystem.unlockTarget, 'course.md / 学生端角色体系 / unlockTarget'),
      phaseId: requiredField(roleSystem['任务阶段'], 'course.md / 学生端角色体系 / 任务阶段'),
    },
    learningView: {
      enabled: parseBoolean(learningView.enabled, PLATFORM_LEARNING_VIEW.enabled),
      default: requestedLearningView,
      allowStudentSwitch: parseBoolean(
        learningView.allowStudentSwitch,
        PLATFORM_LEARNING_VIEW.allowStudentSwitch,
      ),
      allowFutureTaskBrowse: parseBoolean(
        learningView.allowFutureTaskBrowse,
        PLATFORM_LEARNING_VIEW.allowFutureTaskBrowse,
      ),
    },
    roles,
    timeBank: parseTimeBank(source.files['time-bank.md']),
    assets: {
      cover: resolveAssetPath(assetBase, visualAssets['课程封面'], 'backgrounds/cover.png'),
      chat: resolveAssetPath(assetBase, visualAssets['对话背景'], 'backgrounds/chat-bg.png'),
      transition: resolveAssetPath(assetBase, visualAssets['阶段转场'], 'backgrounds/phase-transition.png'),
      certificate: resolveAssetPath(assetBase, visualAssets['完课证书'], 'backgrounds/certificate-bg.png'),
      navigationMap: resolveAssetPath(assetBase, visualAssets['导航地图'], 'maps/navigation-map.png'),
      importPlaceholder: resolveAssetPath(assetBase, visualAssets['导入占位图'], 'videos/video-storm-coming.png'),
      simulationPlaceholder: resolveAssetPath(assetBase, visualAssets['推演占位图'], 'videos/video-simulation.png'),
    },
  };
}
