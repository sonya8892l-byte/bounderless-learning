/**
 * A01-A07 课程活动工具注册表。
 *
 * 这里仅保存平台能力和通用默认值。题目、选项、素材、字段、规则等
 * 课程内容必须由 lesson 的 Markdown 通过「功能模块 / 工具参数」注入。
 */
export const ACTIVITY_TOOL_CATALOG = Object.freeze([
  { id: 'photo', module: 'A01', name: '拍照采集', icon: 'camera', output: 'files' },
  { id: 'audio', module: 'A01', name: '语音记录', icon: 'mic', output: 'recording' },
  { id: 'text', module: 'A01', name: '文字表单', icon: 'notebook-pen', output: 'fields' },
  { id: 'sketch', module: 'A01', name: '画板标注', icon: 'pen-tool', output: 'image' },
  { id: 'quiz', module: 'A02', name: '答题评测', icon: 'list-checks', output: 'answers' },
  { id: 'builder', module: 'A03', name: '拼合搭建', icon: 'blocks', output: 'layout' },
  { id: 'simulation', module: 'A04', name: '沙盘推演', icon: 'waves', output: 'rounds' },
  { id: 'team', module: 'A05', name: '团队协作', icon: 'users', output: 'teamLog' },
  { id: 'media', module: 'A06', name: '沉浸媒体', icon: 'play', output: 'playback' },
  { id: 'scanner', module: 'A07', name: '扫码识别', icon: 'scan-line', output: 'scanResult' },
]);

const CATALOG_BY_ID = Object.fromEntries(ACTIVITY_TOOL_CATALOG.map((tool) => [tool.id, tool]));

const DEFAULT_CONFIG = Object.freeze({
  photo: { minCount: 1, maxCount: 6, accept: 'image/*', recognition: 'course-evidence' },
  audio: { minSeconds: 3, maxSeconds: 90, language: 'zh-CN', transcribe: true },
  text: { fields: [{ id: 'observation', label: '观察记录', type: 'long_text', required: true }] },
  sketch: { width: 720, height: 420, brushColors: ['#8d211f', '#245c4f', '#1f2937'], backgroundImage: '' },
  quiz: { type: 'single_choice', question: '', options: [], answer: null, explanation: '' },
  builder: { mode: 'evidence-wall', items: [], zones: [], connections: [] },
  simulation: { rounds: 1, resources: {}, choices: [], metrics: [] },
  team: { mode: 'discussion', prompt: '', minimumEntries: 1, roles: [] },
  media: { type: 'image', url: '', poster: '', title: '', requireCompletion: true },
  scanner: { mode: 'qr', expectedResults: [], allowManualEntry: true, prompt: '' },
});

/**
 * `posterOnly: true` 是视频工具显式的静态情境图契约。
 *
 * 必须同时满足 video、无 url、有 poster，避免拼错字段或漏配 poster 时
 * 被误当成一个可以完成的课程活动。有真实 url 时始终走正常播放器。
 */
export function isPosterOnlyMedia(config = {}) {
  return String(config.type || '').trim().toLowerCase() === 'video'
    && config.posterOnly === true
    && !String(config.url || '').trim()
    && Boolean(String(config.poster || '').trim());
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function splitTopLevel(value = '') {
  const result = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '(' || character === '（') depth += 1;
    if (character === ')' || character === '）') depth = Math.max(0, depth - 1);
    if ((character === ',' || character === '，') && depth === 0) {
      result.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  result.push(value.slice(start).trim());
  return result.filter(Boolean);
}

function stripCodeFence(value = '') {
  return String(value)
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

export function parseToolParameters(value = '') {
  if (!value || typeof value === 'object') return value && typeof value === 'object' ? clone(value) : {};
  const source = stripCodeFence(value);
  if (!source) return {};
  try {
    return JSON.parse(source);
  } catch {
    const result = {};
    for (const pair of source.split(/[；;\n]+/)) {
      const match = pair.match(/^([^=：:]+)[=：:]\s*(.+)$/);
      if (!match) continue;
      const key = match[1].trim();
      const raw = match[2].trim();
      if (/^(?:true|false)$/i.test(raw)) result[key] = raw.toLowerCase() === 'true';
      else if (/^-?\d+(?:\.\d+)?$/.test(raw)) result[key] = Number(raw);
      else result[key] = raw;
    }
    return result;
  }
}

function toolIdsForModule(code, detail = '') {
  const normalized = detail.replaceAll(' ', '');
  if (code === 'A01') {
    const result = [];
    if (/拍照|相机|图像|照片|camera|photo/i.test(normalized)) result.push('photo');
    if (/语音|录音|音频|audio|record/i.test(normalized)) result.push('audio');
    if (/文字|文本|表单|输入|笔记|text|form/i.test(normalized)) result.push('text');
    if (/画板|标注|绘图|草图|示意图|sketch|draw/i.test(normalized)) result.push('sketch');
    if (!result.length || /多模态/.test(normalized)) return ['photo', 'audio', 'text', 'sketch'];
    return result;
  }
  if (code === 'A02') return ['quiz'];
  if (code === 'A03') return ['builder'];
  if (code === 'A04') return ['simulation'];
  if (code === 'A05') return ['team'];
  if (code === 'A06') return ['media'];
  if (code === 'A07') return ['scanner'];
  return [];
}

function inferredConfig(toolId, detail) {
  if (toolId === 'quiz') {
    if (/多选/.test(detail)) return { type: 'multiple_choice' };
    if (/判断/.test(detail)) return { type: 'true_false' };
    if (/排序/.test(detail)) return { type: 'ordering' };
    if (/填空|数值/.test(detail)) return { type: 'fill_blank' };
    if (/开放|反思|表单/.test(detail)) return { type: 'open_response' };
  }
  if (toolId === 'builder') {
    if (/流程|连线/.test(detail)) return { mode: 'flow' };
    if (/拼图|排序/.test(detail)) return { mode: 'sequence' };
    if (/证据墙|分类/.test(detail)) return { mode: 'evidence-wall' };
  }
  if (toolId === 'team') {
    if (/投票/.test(detail)) return { mode: 'vote' };
    if (/分工/.test(detail)) return { mode: 'roles' };
    if (/证据/.test(detail)) return { mode: 'evidence-board' };
  }
  if (toolId === 'scanner' && /实物|识别/.test(detail)) return { mode: 'object' };
  return {};
}

function parameterConfig(parameters, toolId, onlyTool) {
  if (parameters[toolId] && typeof parameters[toolId] === 'object') return parameters[toolId];
  if (onlyTool && !Object.keys(parameters).some((key) => CATALOG_BY_ID[key])) return parameters;
  return {};
}

export function resolveActivityTools(modules = '', toolParameters = '', toolDefaults = null) {
  const parameters = parseToolParameters(toolParameters);
  const requested = [];
  for (const specification of splitTopLevel(String(modules))) {
    const match = specification.match(/\b(A0[1-7])\b(?:\s*[（(]([\s\S]*?)[）)])?/i);
    if (!match) continue;
    const module = match[1].toUpperCase();
    const detail = match[2] || '';
    for (const id of toolIdsForModule(module, detail)) {
      if (!requested.some((item) => item.id === id)) requested.push({ id, module, detail });
    }
  }

  if (!requested.length && String(modules).trim()) requested.push({ id: 'text', module: 'A01', detail: String(modules) });
  const names = toolDefaults?.names || {};
  const fieldLabels = toolDefaults?.fieldLabels || {};
  return requested.map(({ id, module, detail }) => {
    const catalog = CATALOG_BY_ID[id];
    const courseConfig = parameterConfig(parameters, id, requested.length === 1);
    const config = {
      ...clone(DEFAULT_CONFIG[id]),
      ...inferredConfig(id, detail),
      ...clone(courseConfig),
    };
    // 课程没写 fields 时，默认字段 label 来自平台默认层。
    if (id === 'text' && fieldLabels['text.observation'] && !courseConfig.fields && Array.isArray(config.fields)) {
      config.fields = config.fields.map((field) => (
        field?.id === 'observation' ? { ...field, label: fieldLabels['text.observation'] } : field
      ));
    }
    return {
      ...catalog,
      name: names[id] || catalog.name,
      module,
      config,
    };
  });
}

export function activityToolById(id) {
  return CATALOG_BY_ID[id] || null;
}
