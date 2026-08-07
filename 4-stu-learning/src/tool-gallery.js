import { createIcons, icons } from 'lucide';
import './styles.css';
import './tool-gallery.css';
import lessons from './generated/lesson-public.js';
import {
  renderActivityTools,
  serializableToolValues,
  validateActivityStep,
} from './components/activity-tools.js';

const groups = [
  { id: 'collect', label: '采集记录', tools: ['photo', 'audio', 'text'] },
  { id: 'reason', label: '分析表达', tools: ['sketch', 'quiz'] },
  { id: 'model', label: '建模推演', tools: ['builder', 'simulation'] },
  { id: 'share', label: '协作媒介', tools: ['team', 'media', 'scanner'] },
];

const catalogTools = [
  {
    id: 'photo', module: 'A01', name: '拍照采集', icon: 'camera',
    config: { minCount: 5, maxCount: 8, prompt: '拍摄螭首的正面、侧面、出水口与排列细节，至少5张。' },
  },
  {
    id: 'audio', module: 'A01', name: '语音记录', icon: 'mic',
    config: { minSeconds: 10, maxSeconds: 60, prompt: '口述你的流速测量方法，并说明哪个数据最不确定。' },
  },
  {
    id: 'text', module: 'A01', name: '文字表单', icon: 'notebook-pen',
    config: {
      fields: [
        { id: 'height', label: '估测高差（m）', type: 'number', required: true },
        { id: 'distance', label: '估测距离（m）', type: 'number', required: true },
        { id: 'method', label: '估测方法', type: 'long_text', required: true, placeholder: '说明你如何通过目测和步测得到数据…' },
      ],
    },
  },
  {
    id: 'sketch', module: 'A01', name: '画板标注', icon: 'pen-tool',
    config: { width: 720, height: 360, prompt: '标出高点、低点与排水设施，用箭头画出水流方向。' },
  },
  {
    id: 'quiz', module: 'A02', name: '答题评测', icon: 'list-checks',
    config: {
      type: 'multiple_choice',
      question: '护城河除了防御，还承担了哪些功能？（多选）',
      options: ['汇集并暂存雨水', '消防水源', '城市景观', '加速台基风化'],
      answer: ['汇集并暂存雨水', '消防水源', '城市景观'],
      retryMessage: '再核对一下护城河与宫城安全、用水之间的关系。',
    },
  },
  {
    id: 'builder', module: 'A03', name: '拼合搭建', icon: 'blocks',
    config: {
      prompt: '把排水设施卡片放入对应层级，拼出故宫排水网络。',
      items: [
        { id: 'roof', label: '屋顶与螭首' },
        { id: 'yard', label: '院落明沟' },
        { id: 'ditch', label: '地下干沟' },
        { id: 'river', label: '内金水河' },
      ],
      zones: [
        { id: 'collect', label: '一级 · 就地集水' },
        { id: 'transfer', label: '二级 · 沟渠转输' },
        { id: 'store', label: '三级 · 河道蓄排' },
      ],
      zoneMinimums: { collect: 1, transfer: 1, store: 1 },
    },
  },
  {
    id: 'simulation', module: 'A04', name: '沙盘推演', icon: 'waves',
    config: {
      rounds: 3,
      allowRepeat: false,
      prompt: '选择降雨强度，运行推演并观察河道水位与溢流风险。',
      resources: { 管网容量: '75%', 护城河余量: '42%' },
      metrics: [
        { id: 'level', label: '河道水位', initial: 20 },
        { id: 'risk', label: '溢流风险', initial: 10 },
      ],
      choices: [
        { id: 'normal', label: '正常降雨', effects: { level: 8, risk: 2 }, feedback: '水位小幅上升，各级排水仍有余量。' },
        { id: 'medium', label: '持续中雨', effects: { level: 18, risk: 12 }, feedback: '明沟和干沟持续转输，河道开始承担蓄水压力。' },
        { id: 'storm', label: '短时暴雨', effects: { level: 35, risk: 28 }, feedback: '水位快速上升，需要依靠完整网络分散峰值。' },
      ],
    },
  },
  {
    id: 'team', module: 'A05', name: '团队协作', icon: 'users',
    config: {
      prompt: '汇总不同角色的证据，保留数据来源和不同意见。',
      minimumEntries: 3,
      roles: ['数龙官', '测坡官', '寻沟官', '引河官', '护城官', '真相官'],
      recordTypes: ['现场证据', '估算数据', '质疑与修正'],
    },
  },
  {
    id: 'media', module: 'A06', name: '沉浸媒体', icon: 'play',
    config: {
      type: 'image',
      url: './lessons/lesson_gewu_001/assets/videos/video-simulation.png',
      title: '暴雨来临：故宫排水系统验证',
      prompt: '查看模拟画面，留意最先出现水位变化的环节。',
      requireCompletion: true,
    },
  },
  {
    id: 'scanner', module: 'A07', name: '扫码识别', icon: 'scan-line',
    config: { mode: 'qr', allowManualEntry: true, prompt: '扫描其他角色的证据二维码，或输入证据码完成交换。' },
  },
];

const DEMO_IMAGE = './lessons/lesson_gewu_001/assets/videos/video-simulation.png';
const params = new URLSearchParams(location.search);
const requestedGroup = params.get('group');
const mode = params.get('mode') || (requestedGroup ? 'catalog' : 'course');
const activeGroup = groups.find((group) => group.id === requestedGroup) || groups[0];
const gallery = document.querySelector('#toolGallery');

const sandbox = {
  evidence: { imageUrls: [], files: [], toolValues: {} },
  selectedBuilderItems: new Map(),
  validationRequested: new Set(),
  toastTimer: null,
};

const selection = {
  courseId: lessons.lesson_gewu_001 ? 'lesson_gewu_001' : Object.keys(lessons)[0],
  roleId: '',
  taskId: '',
  stepId: '',
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function truncate(value = '', maximum = 42) {
  const text = String(value).trim();
  return text.length > maximum ? `${text.slice(0, maximum)}…` : text;
}

function currentCourse() {
  return lessons[selection.courseId];
}

function currentRole() {
  return currentCourse()?.roles?.find((role) => role.id === selection.roleId);
}

function tasksWithTools(role = currentRole()) {
  return (role?.tasks || []).filter((task) => (task.steps || []).some((step) => step.tools?.length));
}

function currentTask() {
  return tasksWithTools().find((task) => task.id === selection.taskId);
}

function stepsWithTools(task = currentTask()) {
  return (task?.steps || []).filter((step) => step.tools?.length);
}

function currentStep() {
  return stepsWithTools().find((step) => step.id === selection.stepId);
}

function normalizeSelection(level = 'course') {
  const course = currentCourse();
  if (!course) return;
  if (level === 'course' || !course.roles?.some((role) => role.id === selection.roleId)) {
    const firstRole = course.roles?.find((role) => tasksWithTools(role).length) || course.roles?.[0];
    selection.roleId = firstRole?.id || '';
  }
  const tasks = tasksWithTools();
  if (['course', 'role'].includes(level) || !tasks.some((task) => task.id === selection.taskId)) {
    selection.taskId = tasks[0]?.id || '';
  }
  const steps = stepsWithTools();
  if (['course', 'role', 'task'].includes(level) || !steps.some((step) => step.id === selection.stepId)) {
    selection.stepId = steps[0]?.id || '';
  }
}

normalizeSelection();

function visibleTools() {
  if (mode === 'course') return currentStep()?.tools || [];
  return activeGroup.tools.map((id) => catalogTools.find((tool) => tool.id === id)).filter(Boolean);
}

function contextFor(tool) {
  if (mode === 'course') {
    return { taskId: selection.taskId, stepId: selection.stepId, tool };
  }
  return { taskId: `${tool.id}-task`, stepId: `${tool.id}-demo`, tool };
}

function activityValue(tool) {
  const { stepId } = contextFor(tool);
  sandbox.evidence.toolValues[stepId] ||= {};
  sandbox.evidence.toolValues[stepId][tool.id] ||= {};
  return sandbox.evidence.toolValues[stepId][tool.id];
}

function valueKey(tool) {
  const { stepId } = contextFor(tool);
  return `${stepId}:${tool.id}`;
}

function serializableValue(tool) {
  const { stepId } = contextFor(tool);
  return serializableToolValues(sandbox.evidence)[stepId]?.[tool.id] || {};
}

function validationFor(tool) {
  const { stepId } = contextFor(tool);
  const error = validateActivityStep({ tools: [tool], evidence: sandbox.evidence, stepId });
  return { passed: !error, message: error || '已通过本地完成条件校验。' };
}

function diagnosticsMarkup(tool) {
  const validation = validationFor(tool);
  const requested = sandbox.validationRequested.has(valueKey(tool));
  const stateClass = validation.passed ? 'is-passed' : requested ? 'is-failed' : 'is-pending';
  const stateLabel = validation.passed ? '校验通过' : requested ? '校验未通过' : '等待完成';
  return `
    <aside class="sandbox-diagnostics ${stateClass}" data-sandbox-diagnostics>
      <div class="sandbox-result">
        <span>${stateLabel}</span>
        <p>${escapeHtml(validation.message)}</p>
      </div>
      <div class="sandbox-card-actions">
        <button type="button" data-sandbox-action="sample">载入示例</button>
        <button type="button" data-sandbox-action="validate">运行校验</button>
        <button type="button" data-sandbox-action="reset">重置</button>
      </div>
      <details>
        <summary>查看本地证据数据</summary>
        <p>这是工具会提供给课程逻辑的可序列化数据；本地媒体和临时对象已隐藏。</p>
        <pre>${escapeHtml(JSON.stringify(serializableValue(tool), null, 2))}</pre>
      </details>
      <details>
        <summary>查看工具参数</summary>
        <pre>${escapeHtml(JSON.stringify(tool.config || {}, null, 2))}</pre>
      </details>
    </aside>
  `;
}

function toolCardContents(tool) {
  const { taskId, stepId } = contextFor(tool);
  return `
    <div class="gallery-item__meta">
      <span>${escapeHtml(tool.module)}</span>
      <strong>${escapeHtml(tool.name)}</strong>
      <em>${escapeHtml(tool.id)}</em>
    </div>
    <div class="gallery-item__workspace">
      <div class="sandbox-tool-stage">
        ${renderActivityTools({ tools: [tool], evidence: sandbox.evidence, allEvidence: {}, taskId, stepId })}
      </div>
      ${diagnosticsMarkup(tool)}
    </div>
  `;
}

function optionsMarkup(items, selectedId, label) {
  return items.map((item, index) => {
    const id = item.id;
    const text = label(item, index);
    return `<option value="${escapeHtml(id)}" ${id === selectedId ? 'selected' : ''}>${escapeHtml(text)}</option>`;
  }).join('');
}

function coursePickerMarkup() {
  const course = currentCourse();
  const role = currentRole();
  const task = currentTask();
  const step = currentStep();
  return `
    <section class="course-picker" aria-label="真实课程工具选择">
      <div class="course-picker__grid">
        <label><span>课程</span><select data-course-select="course">${optionsMarkup(Object.values(lessons), selection.courseId, (item) => item.title)}</select></label>
        <label><span>角色</span><select data-course-select="role">${optionsMarkup(course?.roles || [], selection.roleId, (item) => item.name)}</select></label>
        <label><span>任务</span><select data-course-select="task">${optionsMarkup(tasksWithTools(), selection.taskId, (item) => item.name)}</select></label>
        <label><span>Step</span><select data-course-select="step">${optionsMarkup(stepsWithTools(), selection.stepId, (item, index) => `${index + 1}. ${truncate(item.studentAction || item.objective || item.id)}`)}</select></label>
      </div>
      <div class="course-picker__context">
        <span>${escapeHtml([course?.series, role?.name, task?.name].filter(Boolean).join(' · '))}</span>
        <strong>${escapeHtml(step?.studentAction || step?.objective || '这个任务暂时没有配置工具 Step')}</strong>
        ${step ? `<small>完成方式：${escapeHtml(step.completionMode || '未设置')} · Step ID：${escapeHtml(step.id)}</small>` : ''}
      </div>
    </section>
  `;
}

function catalogTabsMarkup() {
  return `
    <nav class="gallery-tabs" aria-label="工具分类">
      ${groups.map((group) => `<a href="?mode=catalog&group=${group.id}" class="${group.id === activeGroup.id ? 'is-active' : ''}">${group.label}<small>${group.tools.length}项</small></a>`).join('')}
    </nav>
  `;
}

function sectionHeaderMarkup(tools) {
  if (mode === 'course') {
    return `<div class="gallery-section__head"><span>真实课程 STEP</span><strong>${tools.length ? tools.map((tool) => tool.name).join(' · ') : '当前 Step 没有工具'}</strong></div>`;
  }
  return `<div class="gallery-section__head"><span>${activeGroup.label}</span><strong>${tools.map((tool) => tool.name).join(' · ')}</strong></div>`;
}

function renderGallery() {
  const tools = visibleTools();
  gallery.innerHTML = `
    <header class="gallery-hero">
      <a href="./" class="gallery-back"><i data-lucide="arrow-left"></i>学生端</a>
      <span class="gallery-kicker">故宫课程 · 隔离工具沙盒</span>
      <h1>单独操作工具，不推进课程</h1>
      <p>使用学生端真实渲染器和完成条件；状态只保存在当前标签页内存中。</p>
    </header>
    <section class="sandbox-safety">
      <div><i data-lucide="shield-check"></i><span><strong>隔离运行中</strong><small>0 次课程写入 · 0 次 Step 推进 · 刷新即清空</small></span></div>
      <button type="button" data-sandbox-action="reset-visible"><i data-lucide="rotate-ccw"></i>重置当前页面</button>
    </section>
    <nav class="sandbox-modes" aria-label="沙盒数据来源">
      <a href="?mode=course" class="${mode === 'course' ? 'is-active' : ''}"><i data-lucide="book-open-check"></i>真实课程 Step</a>
      <a href="?mode=catalog&group=${activeGroup.id}" class="${mode === 'catalog' ? 'is-active' : ''}"><i data-lucide="layout-grid"></i>工具目录</a>
    </nav>
    ${mode === 'course' ? coursePickerMarkup() : catalogTabsMarkup()}
    <section class="gallery-section">
      ${sectionHeaderMarkup(tools)}
      ${tools.map((tool) => `<article class="gallery-item" id="tool-${escapeHtml(tool.id)}" data-tool-id="${escapeHtml(tool.id)}">${toolCardContents(tool)}</article>`).join('') || '<div class="sandbox-empty">请选择包含工具配置的课程 Step。</div>'}
    </section>
    <footer class="gallery-footer">独立内存状态 · 真实工具渲染器 · 本地完成条件校验</footer>
    <div class="sandbox-toast" id="sandboxToast" role="status"></div>
  `;
  hydrateRenderedContent(gallery);
}

function toolById(id) {
  return visibleTools().find((tool) => tool.id === id);
}

function articleFor(tool) {
  return gallery.querySelector(`[data-tool-id="${tool.id}"]`);
}

function renderTool(tool) {
  const article = articleFor(tool);
  if (!article) return;
  article.innerHTML = toolCardContents(tool);
  hydrateRenderedContent(article);
}

function refreshDiagnostics(tool) {
  const article = articleFor(tool);
  const current = article?.querySelector('[data-sandbox-diagnostics]');
  if (!current) return;
  current.outerHTML = diagnosticsMarkup(tool);
}

function showToast(message) {
  const toast = document.querySelector('#sandboxToast');
  if (!toast) return;
  window.clearTimeout(sandbox.toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  sandbox.toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function drawCanvasImage(canvas, source) {
  if (!source) return;
  const image = new Image();
  image.onload = () => canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  image.src = source;
}

function hydrateSketchCanvases(root) {
  root.querySelectorAll('[data-sketch-canvas]').forEach((canvas) => {
    if (canvas.dataset.hydrated === 'true') return;
    canvas.dataset.hydrated = 'true';
    canvas.dataset.brush = '#8d211f';
    const context = canvas.getContext('2d');
    context.fillStyle = '#fffdf8';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawCanvasImage(canvas, canvas.dataset.snapshot || canvas.dataset.background);
    let drawing = false;
    const point = (event) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * (canvas.width / rect.width),
        y: (event.clientY - rect.top) * (canvas.height / rect.height),
      };
    };
    canvas.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      drawing = true;
      canvas.setPointerCapture(event.pointerId);
      const start = point(event);
      context.beginPath();
      context.moveTo(start.x, start.y);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!drawing) return;
      const next = point(event);
      context.strokeStyle = canvas.dataset.brush || '#8d211f';
      context.lineWidth = 5;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.lineTo(next.x, next.y);
      context.stroke();
    });
    const finish = () => {
      if (!drawing) return;
      drawing = false;
      const tool = toolById('sketch');
      if (!tool) return;
      const value = activityValue(tool);
      value.dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      value.completed = true;
      refreshDiagnostics(tool);
      const status = canvas.closest('.activity-tool')?.querySelector('.activity-tool__header em');
      if (status) status.textContent = '已绘制';
    };
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
  });
}

function hydrateRenderedContent(root) {
  createIcons({ icons });
  hydrateSketchCanvases(root);
}

function cleanupLocalValue(value = {}) {
  value.cancelled = true;
  window.clearTimeout(value.autoStopTimer);
  value.recognition?.stop?.();
  if (value.recorder?.state === 'recording') value.recorder.stop();
  value.stream?.getTracks?.().forEach((track) => track.stop());
  [value.url, value.previewUrl, ...(value.imageUrls || [])].filter((url) => String(url).startsWith('blob:')).forEach((url) => URL.revokeObjectURL(url));
}

function resetTool(tool, rerender = true) {
  const { stepId } = contextFor(tool);
  const value = sandbox.evidence.toolValues[stepId]?.[tool.id];
  if (value) cleanupLocalValue(value);
  if (sandbox.evidence.toolValues[stepId]) delete sandbox.evidence.toolValues[stepId][tool.id];
  sandbox.selectedBuilderItems.delete(valueKey(tool));
  sandbox.validationRequested.delete(valueKey(tool));
  if (rerender) renderTool(tool);
}

function resetVisibleTools() {
  visibleTools().forEach((tool) => resetTool(tool, false));
  renderGallery();
  showToast('当前页面的沙盒状态已清空。');
}

function sampleBuilderValue(tool) {
  const items = (tool.config?.items || []).map((item) => item.id || item);
  const zones = tool.config?.zones?.length ? tool.config.zones.map((zone) => zone.id) : ['workspace'];
  const placements = Object.fromEntries(zones.map((zone) => [zone, []]));
  const remaining = [...items];
  for (const zone of zones) {
    const minimum = Number(tool.config?.zoneMinimums?.[zone] || 0);
    placements[zone].push(...remaining.splice(0, minimum));
  }
  remaining.forEach((item, index) => placements[zones[index % zones.length]].push(item));
  return { placements };
}

function sampleSimulationValue(tool) {
  const rounds = Number(tool.config?.rounds || 1);
  const choices = tool.config?.choices || [];
  const metrics = Object.fromEntries((tool.config?.metrics || []).map((metric) => [metric.id, Number.isFinite(Number(metric.initial)) ? Number(metric.initial) : (metric.initialLabel || 0)]));
  const history = [];
  for (let index = 0; index < rounds; index += 1) {
    const choice = choices[index % Math.max(choices.length, 1)];
    if (!choice) break;
    Object.entries(choice.effects || {}).forEach(([metricId, delta]) => {
      metrics[metricId] = Number(metrics[metricId] || 0) + Number(delta || 0);
    });
    history.push({ id: choice.id, label: choice.label, feedback: choice.feedback || choice.publicFeedback || '本轮结果已记录。' });
  }
  return { pendingChoice: '', history, metrics };
}

function sampleValueFor(tool) {
  const config = tool.config || {};
  if (tool.id === 'photo') {
    const count = Number(config.minCount || 1);
    return { count, imageUrls: Array.from({ length: count }, () => DEMO_IMAGE) };
  }
  if (tool.id === 'audio') return { durationSeconds: Math.max(Number(config.minSeconds || 3), 12), transcript: '我先说明观察方法，再指出数据中最需要复核的部分。' };
  if (tool.id === 'text') {
    return { fields: Object.fromEntries((config.fields || []).map((field, index) => [field.id, field.type === 'number' ? String(index + 2) : field.type === 'select' ? (field.options?.[0] || '') : `这是“${field.label}”的沙盒示例记录，用于检查字段和完成条件。`])) };
  }
  if (tool.id === 'sketch') return { dataUrl: DEMO_IMAGE, completed: true };
  if (tool.id === 'quiz') {
    if (config.type === 'ordering') return { order: clone(config.answer || config.options || []) };
    return { answer: clone(config.answer ?? (config.type === 'multiple_choice' ? (config.options || []).slice(0, 1) : config.options?.[0] || '沙盒示例回答')) };
  }
  if (tool.id === 'builder') return sampleBuilderValue(tool);
  if (tool.id === 'simulation') return sampleSimulationValue(tool);
  if (tool.id === 'team') {
    const minimum = Number(config.minimumEntries || 1);
    const types = config.requiredRecordTypes?.length ? config.requiredRecordTypes : config.recordTypes || [];
    return {
      entries: Array.from({ length: minimum }, (_, index) => ({
        role: config.roles?.[index % Math.max(config.roles?.length || 0, 1)] || '',
        type: types[index % Math.max(types.length, 1)] || '',
        text: `第 ${index + 1} 条沙盒协作记录：保留证据来源与小组判断。`,
      })),
    };
  }
  if (tool.id === 'media') return { completed: true };
  if (tool.id === 'scanner') return { manual: 'EVIDENCE-DEMO-001', result: 'EVIDENCE-DEMO-001' };
  return {};
}

function loadSample(tool) {
  resetTool(tool, false);
  const { stepId } = contextFor(tool);
  sandbox.evidence.toolValues[stepId] ||= {};
  sandbox.evidence.toolValues[stepId][tool.id] = sampleValueFor(tool);
  sandbox.validationRequested.add(valueKey(tool));
  renderTool(tool);
  showToast(`已载入“${tool.name}”示例，只存在当前页面。`);
}

async function toggleAudio(tool) {
  const value = activityValue(tool);
  if (value.recording && value.recorder) {
    window.clearTimeout(value.autoStopTimer);
    value.recognition?.stop?.();
    value.recorder.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    showToast('当前浏览器不支持录音，请使用支持麦克风的现代浏览器。');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = Recognition ? new Recognition() : null;
    const chunks = [];
    recorder.addEventListener('dataavailable', (event) => { if (event.data.size) chunks.push(event.data); });
    recorder.addEventListener('stop', () => {
      value.stream?.getTracks().forEach((track) => track.stop());
      if (value.cancelled) return;
      if (value.url?.startsWith('blob:')) URL.revokeObjectURL(value.url);
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      value.blob = blob;
      value.url = URL.createObjectURL(blob);
      value.durationSeconds = Math.max(1, Math.round((Date.now() - value.startedAt) / 1000));
      value.recording = false;
      window.clearTimeout(value.autoStopTimer);
      delete value.recorder;
      delete value.stream;
      delete value.recognition;
      renderTool(tool);
    });
    value.recorder = recorder;
    value.stream = stream;
    value.startedAt = Date.now();
    value.recording = true;
    if (recognition) {
      recognition.lang = 'zh-CN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        value.transcript = [...event.results].map((result) => result[0].transcript).join('');
      };
      recognition.onerror = () => undefined;
      try { recognition.start(); value.recognition = recognition; } catch { /* 转写不可用时仍保留录音。 */ }
    }
    recorder.start();
    const maximum = Number(tool.config?.maxSeconds || 90);
    value.autoStopTimer = window.setTimeout(() => {
      if (recorder.state === 'recording') {
        value.recognition?.stop?.();
        recorder.stop();
        showToast(`已达到 ${maximum} 秒上限，录音自动结束。`);
      }
    }, maximum * 1000);
    renderTool(tool);
  } catch {
    showToast('没有取得麦克风权限，请允许后再试。');
  }
}

function clearSketch(tool) {
  const canvas = articleFor(tool)?.querySelector('[data-sketch-canvas]');
  if (!canvas) return;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fffdf8';
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawCanvasImage(canvas, canvas.dataset.background);
  const value = activityValue(tool);
  value.dataUrl = '';
  value.completed = false;
  renderTool(tool);
}

function moveOrderItem(tool, index, direction) {
  const value = activityValue(tool);
  const order = value.order?.length ? [...value.order] : [...(tool.config?.options || [])];
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= order.length) return;
  [order[index], order[target]] = [order[target], order[index]];
  value.order = order;
  renderTool(tool);
}

function runSimulation(tool) {
  const value = activityValue(tool);
  const choice = tool.config?.choices?.find((item) => item.id === value.pendingChoice);
  if (!choice) return showToast('请先选择本轮方案。');
  value.history ||= [];
  if (value.history.length >= Number(tool.config?.rounds || 1)) return;
  if (tool.config?.allowRepeat === false && value.history.some((entry) => entry.id === choice.id)) {
    value.pendingChoice = '';
    renderTool(tool);
    return showToast('这一分支已经运行过，请换一种方案。');
  }
  value.metrics ||= Object.fromEntries((tool.config?.metrics || []).map((metric) => [metric.id, Number.isFinite(Number(metric.initial)) ? Number(metric.initial) : (metric.initialLabel || 0)]));
  Object.entries(choice.effects || {}).forEach(([metricId, delta]) => {
    value.metrics[metricId] = Number(value.metrics[metricId] || 0) + Number(delta || 0);
  });
  value.history.push({ id: choice.id, label: choice.label, feedback: choice.feedback || choice.publicFeedback || '本轮结果已记录，继续比较下一种可能。' });
  value.pendingChoice = '';
  renderTool(tool);
}

function addTeamEntry(tool) {
  const value = activityValue(tool);
  const text = String(value.draft || '').trim();
  if (!text) return showToast('先写下一条观点、分工或证据。');
  if (tool.config?.roles?.length && !value.selectedRole) return showToast('请先选择贡献角色。');
  if (tool.config?.recordTypes?.length && !value.recordType) return showToast('请先选择记录类型。');
  value.entries ||= [];
  value.entries.push({ text, role: value.selectedRole || '', type: value.recordType || '' });
  value.draft = '';
  value.recordType = '';
  renderTool(tool);
}

function confirmScan(tool) {
  const value = activityValue(tool);
  const result = String(value.manual || '').trim();
  if (!result) return showToast('请扫描或输入课程码。');
  value.result = result;
  renderTool(tool);
}

function placeBuilderItem(tool, zoneId, itemId) {
  if (!itemId) return showToast('请先选择一张卡片。');
  const value = activityValue(tool);
  value.placements ||= {};
  Object.keys(value.placements).forEach((key) => {
    value.placements[key] = value.placements[key].filter((candidate) => candidate !== itemId);
  });
  value.placements[zoneId] ||= [];
  value.placements[zoneId].push(itemId);
  sandbox.selectedBuilderItems.delete(valueKey(tool));
  renderTool(tool);
}

function returnBuilderItem(tool, zoneId, itemId) {
  const value = activityValue(tool);
  value.placements ||= {};
  value.placements[zoneId] = (value.placements[zoneId] || []).filter((candidate) => candidate !== itemId);
  renderTool(tool);
}

async function handlePhotoFiles(tool, files) {
  if (!files.length) return;
  const value = activityValue(tool);
  value.imageUrls ||= [];
  value.files ||= [];
  const maximum = Number(tool.config?.maxCount || 6);
  const remaining = Math.max(0, maximum - value.imageUrls.length);
  if (!remaining) return showToast(`这个工具最多保留 ${maximum} 张照片。`);
  const accepted = files.slice(0, remaining);
  value.imageUrls.push(...accepted.map((file) => URL.createObjectURL(file)));
  value.files.push(...accepted);
  value.count = value.imageUrls.length;
  if (accepted.length < files.length) showToast(`本次保留 ${accepted.length} 张，已经达到上限。`);
  renderTool(tool);
}

async function handleScanFile(tool, file) {
  if (!file) return;
  const value = activityValue(tool);
  if (value.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(value.previewUrl);
  value.previewUrl = URL.createObjectURL(file);
  value.captured = true;
  value.fileName = file.name;
  if ('BarcodeDetector' in window && tool.config?.mode !== 'object') {
    try {
      const bitmap = await createImageBitmap(file);
      const detector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
      const codes = await detector.detect(bitmap);
      bitmap.close?.();
      if (codes[0]?.rawValue) value.result = codes[0].rawValue;
      else showToast('没有读出码值，可以在下方手动输入。');
    } catch {
      showToast('自动识别不可用，可以在下方手动输入。');
    }
  } else if (tool.config?.mode === 'object') {
    value.result = '已采集待 AI 核验的实物图像';
  } else {
    showToast('当前浏览器没有扫码能力，可以在下方手动输入。');
  }
  renderTool(tool);
}

function updateActivityField(target, tool) {
  const value = activityValue(tool);
  const { fieldId } = target.dataset;
  if (tool.id === 'text') {
    value.fields ||= {};
    value.fields[fieldId] = target.value;
  } else if (tool.id === 'quiz' && target.type === 'checkbox') {
    value.answer = [...articleFor(tool).querySelectorAll('[data-tool-id="quiz"]:checked')].map((item) => item.value);
  } else if (tool.id === 'quiz' && target.type === 'radio') {
    value.answer = target.value;
  } else {
    value[fieldId] = target.value;
  }
  target.closest('.quiz-option')?.classList.toggle('is-selected', target.checked);
  refreshDiagnostics(tool);
}

gallery.addEventListener('click', async (event) => {
  const sandboxTarget = event.target.closest('[data-sandbox-action]');
  if (sandboxTarget) {
    const action = sandboxTarget.dataset.sandboxAction;
    if (action === 'reset-visible') return resetVisibleTools();
    const tool = toolById(sandboxTarget.closest('[data-tool-id]')?.dataset.toolId);
    if (!tool) return;
    if (action === 'sample') return loadSample(tool);
    if (action === 'reset') { resetTool(tool); return showToast(`“${tool.name}”已重置。`); }
    if (action === 'validate') {
      sandbox.validationRequested.add(valueKey(tool));
      refreshDiagnostics(tool);
      const validation = validationFor(tool);
      return showToast(validation.message);
    }
  }

  const actionTarget = event.target.closest('[data-action]');
  if (!actionTarget) return;
  const tool = toolById(actionTarget.closest('[data-tool-id]')?.dataset.toolId);
  if (!tool) return;
  const action = actionTarget.dataset.action;
  if (action === 'toggle-activity-recording') return toggleAudio(tool);
  if (action === 'select-sketch-color') {
    const canvas = articleFor(tool).querySelector('[data-sketch-canvas]');
    if (canvas) canvas.dataset.brush = actionTarget.dataset.color;
    return;
  }
  if (action === 'clear-sketch') return clearSketch(tool);
  if (action === 'move-order-item') return moveOrderItem(tool, Number(actionTarget.dataset.index), actionTarget.dataset.direction);
  if (action === 'choose-simulation') {
    activityValue(tool).pendingChoice = actionTarget.dataset.choiceId;
    return renderTool(tool);
  }
  if (action === 'run-simulation') return runSimulation(tool);
  if (action === 'add-team-entry') return addTeamEntry(tool);
  if (action === 'complete-media') {
    activityValue(tool).completed = true;
    return renderTool(tool);
  }
  if (action === 'confirm-scan') return confirmScan(tool);
  if (action === 'select-builder-item') {
    sandbox.selectedBuilderItems.set(valueKey(tool), actionTarget.dataset.builderItem);
    articleFor(tool).querySelectorAll('[data-builder-item]').forEach((item) => item.classList.toggle('is-selected', item === actionTarget));
    return showToast('已选中卡片，请点击目标区域的“放到这里”。');
  }
  if (action === 'place-selected-builder') return placeBuilderItem(tool, actionTarget.dataset.zoneId, sandbox.selectedBuilderItems.get(valueKey(tool)));
  if (action === 'return-builder-item') return returnBuilderItem(tool, actionTarget.dataset.zoneId, actionTarget.dataset.itemId);
});

gallery.addEventListener('input', (event) => {
  const target = event.target.closest('[data-activity-field]');
  if (!target) return;
  const tool = toolById(target.closest('[data-tool-id]')?.dataset.toolId);
  if (tool) updateActivityField(target, tool);
});

gallery.addEventListener('change', async (event) => {
  const article = event.target.closest('[data-tool-id]');
  const tool = toolById(article?.dataset.toolId);
  if (!tool) return;
  if (event.target.dataset.taskFile) await handlePhotoFiles(tool, [...(event.target.files || [])]);
  if (event.target.hasAttribute('data-scan-file')) await handleScanFile(tool, event.target.files?.[0]);
});

gallery.addEventListener('ended', (event) => {
  if (!event.target.hasAttribute('data-activity-media')) return;
  const tool = toolById(event.target.closest('[data-tool-id]')?.dataset.toolId);
  if (!tool) return;
  activityValue(tool).completed = true;
  refreshDiagnostics(tool);
}, true);

gallery.addEventListener('dragstart', (event) => {
  const item = event.target.closest('[data-builder-item]');
  const tool = toolById(item?.closest('[data-tool-id]')?.dataset.toolId);
  if (!item || !tool) return;
  sandbox.selectedBuilderItems.set(valueKey(tool), item.dataset.builderItem);
  event.dataTransfer?.setData('text/plain', item.dataset.builderItem);
});

gallery.addEventListener('dragover', (event) => {
  if (event.target.closest('[data-builder-zone]')) event.preventDefault();
});

gallery.addEventListener('drop', (event) => {
  const zone = event.target.closest('[data-builder-zone]');
  const tool = toolById(zone?.closest('[data-tool-id]')?.dataset.toolId);
  if (!zone || !tool) return;
  event.preventDefault();
  const itemId = event.dataTransfer?.getData('text/plain') || sandbox.selectedBuilderItems.get(valueKey(tool));
  placeBuilderItem(tool, zone.dataset.builderZone, itemId);
});

gallery.addEventListener('change', (event) => {
  const select = event.target.closest('[data-course-select]');
  if (!select) return;
  if (select.dataset.courseSelect === 'course') {
    selection.courseId = select.value;
    normalizeSelection('course');
  } else if (select.dataset.courseSelect === 'role') {
    selection.roleId = select.value;
    normalizeSelection('role');
  } else if (select.dataset.courseSelect === 'task') {
    selection.taskId = select.value;
    normalizeSelection('task');
  } else {
    selection.stepId = select.value;
    normalizeSelection('step');
  }
  renderGallery();
});

window.addEventListener('beforeunload', () => {
  Object.values(sandbox.evidence.toolValues).forEach((step) => Object.values(step).forEach(cleanupLocalValue));
});

renderGallery();
