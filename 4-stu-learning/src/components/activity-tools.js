import { isPosterOnlyMedia } from '../engine/tool-registry.js';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toolState(evidence, stepId, toolId) {
  return evidence.toolValues?.[stepId]?.[toolId] || {};
}

function toolShell(tool, body, status = '') {
  return `
    <section class="activity-tool activity-tool--${escapeHtml(tool.id)}" data-activity-tool="${escapeHtml(tool.id)}">
      <header class="activity-tool__header">
        <span><i data-lucide="${escapeHtml(tool.icon)}"></i></span>
        <div><strong>${escapeHtml(tool.name)}</strong><small>${escapeHtml(tool.module)}</small></div>
        ${status ? `<em>${escapeHtml(status)}</em>` : ''}
      </header>
      <div class="activity-tool__body">${body}</div>
    </section>
  `;
}

function renderActivitySelect({
  taskId,
  stepId,
  toolId,
  fieldId,
  value = '',
  options = [],
  placeholder = '请选择',
  label = placeholder,
}) {
  const selected = String(value || '');
  return `<details class="activity-select">
    <summary aria-label="${escapeHtml(label)}，当前选择：${escapeHtml(selected || '未选择')}">
      <span class="${selected ? '' : 'is-placeholder'}">${escapeHtml(selected || placeholder)}</span>
    </summary>
    <div class="activity-select__options" role="listbox" aria-label="${escapeHtml(label)}">
      ${(options || []).map((option) => {
        const optionValue = String(option);
        const isSelected = optionValue === selected;
        return `<button type="button" role="option" aria-selected="${isSelected}"
          data-action="choose-activity-option" data-task-id="${escapeHtml(taskId)}"
          data-step-id="${escapeHtml(stepId)}" data-tool-id="${escapeHtml(toolId)}"
          data-field-id="${escapeHtml(fieldId)}" data-value="${escapeHtml(optionValue)}"
          class="${isSelected ? 'is-selected' : ''}">${escapeHtml(optionValue)}</button>`;
      }).join('')}
    </div>
  </details>`;
}

function renderPhoto(tool, context) {
  const { evidence, taskId, stepId } = context;
  const config = tool.config || {};
  const value = toolState(evidence, stepId, tool.id);
  const images = value.imageUrls || [];
  const count = Number(value.count ?? images.length ?? 0);
  const minimum = Number(config.minCount || 1);
  const locked = Boolean(value.processing || value.revisionSubmitting);
  return toolShell(tool, `
    ${config.referenceImage ? `<img class="activity-reference" src="${escapeHtml(config.referenceImage)}" alt="课程配置的拍摄参考图" />` : ''}
    <p>${escapeHtml(config.prompt || `请采集至少 ${minimum} 张符合要求的现场照片。`)}</p>
    <label class="activity-upload ${locked ? 'is-processing' : ''}">
      <i data-lucide="camera"></i>
      <span>${value.revisionSubmitting ? '正在检查当前照片…' : value.processing ? '正在准备图像检查…' : count ? `继续拍摄（已选 ${count} 张）` : '打开相机或相册'}</span>
      <input type="file" accept="${escapeHtml(config.accept || 'image/*')}" capture="environment" multiple
        data-task-file="${escapeHtml(taskId)}" data-tool-step="${escapeHtml(stepId)}" ${locked ? 'disabled' : ''} />
    </label>
    ${count ? `<div class="activity-thumbnails">${images.map((url, index) => `
      <figure class="activity-thumbnail">
        <img src="${escapeHtml(url)}" alt="本小步现场证据 ${index + 1}" />
        <button type="button" data-action="remove-photo" data-task-id="${escapeHtml(taskId)}"
          data-step-id="${escapeHtml(stepId)}" data-photo-index="${index}"
          aria-label="删除第 ${index + 1} 张照片" ${locked ? 'disabled' : ''}>
          <i data-lucide="x"></i><span>删除</span>
        </button>
      </figure>
    `).join('')}</div>` : ''}
  `, `${count}/${minimum}`);
}

function renderAudio(tool, context) {
  const value = toolState(context.evidence, context.stepId, tool.id);
  const seconds = Number(value.durationSeconds || 0);
  const recording = Boolean(value.recording);
  return toolShell(tool, `
    <p>${escapeHtml(tool.config?.prompt || `录一段 ${tool.config?.minSeconds || 3}—${tool.config?.maxSeconds || 90} 秒的现场口述。`)}</p>
    <button class="activity-action ${recording ? 'is-recording' : ''}" type="button" data-action="toggle-activity-recording"
      data-task-id="${escapeHtml(context.taskId)}" data-step-id="${escapeHtml(context.stepId)}" data-tool-id="audio">
      <i data-lucide="${recording ? 'square' : 'mic'}"></i>${recording ? '结束录音' : seconds ? '重新录音' : '开始录音'}
    </button>
    ${seconds ? `<div class="activity-result"><i data-lucide="circle-check-big"></i><div>已记录 ${seconds} 秒${value.transcript ? `<small>转写：${escapeHtml(value.transcript)}</small>` : ''}</div>${value.url ? `<audio src="${value.url}" controls></audio>` : ''}</div>` : ''}
  `, recording ? '录音中' : seconds ? `${seconds}秒` : '待录制');
}

function renderText(tool, context) {
  const value = toolState(context.evidence, context.stepId, tool.id);
  const fields = tool.config?.fields?.length ? tool.config.fields : [{ id: 'observation', label: '观察记录', type: 'long_text', required: true }];
  return toolShell(tool, `
    <div class="activity-fields">
      ${fields.map((field) => {
        const current = value.fields?.[field.id] || '';
        const attributes = `data-activity-field data-task-id="${escapeHtml(context.taskId)}" data-step-id="${escapeHtml(context.stepId)}" data-tool-id="text" data-field-id="${escapeHtml(field.id)}"`;
        const lengthLimit = field.maxLength ? `maxlength="${Number(field.maxLength)}"` : '';
        if (field.type === 'select') {
          return `<div class="activity-field"><span>${escapeHtml(field.label)}${field.required ? ' *' : ''}</span>${renderActivitySelect({
            taskId: context.taskId,
            stepId: context.stepId,
            toolId: 'text',
            fieldId: field.id,
            value: current,
            options: field.options,
            label: field.label,
          })}</div>`;
        }
        if (field.type === 'number') {
          return `<label><span>${escapeHtml(field.label)}${field.required ? ' *' : ''}</span><input type="number" value="${escapeHtml(current)}" placeholder="${escapeHtml(field.placeholder || '')}" ${attributes} /></label>`;
        }
        if (field.type === 'short_text') {
          return `<label><span>${escapeHtml(field.label)}${field.required ? ' *' : ''}</span><input type="text" value="${escapeHtml(current)}" placeholder="${escapeHtml(field.placeholder || '')}" ${lengthLimit} ${attributes} /></label>`;
        }
        return `<label><span>${escapeHtml(field.label)}${field.required ? ' *' : ''}</span><textarea rows="3" placeholder="${escapeHtml(field.placeholder || '写下你的观察和判断…')}" ${lengthLimit} ${attributes}>${escapeHtml(current)}</textarea></label>`;
      }).join('')}
    </div>
  `, Object.values(value.fields || {}).filter((item) => String(item).trim()).length ? '已填写' : '待填写');
}

function renderSketch(tool, context) {
  const value = toolState(context.evidence, context.stepId, tool.id);
  const colors = tool.config?.brushColors || ['#8d211f', '#245c4f', '#1f2937'];
  return toolShell(tool, `
    <p>${escapeHtml(tool.config?.prompt || '在画板上圈画、连线或绘制你的示意图。')}</p>
    <div class="sketch-toolbar">
      ${colors.map((color, index) => `<button type="button" data-action="select-sketch-color" data-color="${escapeHtml(color)}" data-canvas-id="${escapeHtml(context.stepId)}" style="--swatch:${escapeHtml(color)}" aria-label="选择画笔颜色 ${index + 1}"></button>`).join('')}
      <button type="button" data-action="clear-sketch" data-task-id="${escapeHtml(context.taskId)}" data-step-id="${escapeHtml(context.stepId)}"><i data-lucide="eraser"></i>清空</button>
    </div>
    <canvas class="activity-sketch" width="${Number(tool.config?.width || 720)}" height="${Number(tool.config?.height || 420)}"
      data-sketch-canvas data-task-id="${escapeHtml(context.taskId)}" data-step-id="${escapeHtml(context.stepId)}"
      data-background="${escapeHtml(tool.config?.backgroundImage || '')}" data-snapshot="${escapeHtml(value.dataUrl || '')}"></canvas>
  `, value.dataUrl ? '已绘制' : '待绘制');
}

function renderQuiz(tool, context) {
  const config = tool.config || {};
  const value = toolState(context.evidence, context.stepId, tool.id);
  const answer = value.answer;
  const options = config.options || [];
  const attributes = `data-activity-field data-task-id="${escapeHtml(context.taskId)}" data-step-id="${escapeHtml(context.stepId)}" data-tool-id="quiz" data-field-id="answer"`;
  let control = '';
  if (config.type === 'ordering') {
    const order = value.order?.length ? value.order : options;
    control = `<ol class="ordering-list">${order.map((option, index) => `<li><span>${index + 1}</span><strong>${escapeHtml(option)}</strong><button type="button" data-action="move-order-item" data-direction="up" data-index="${index}" data-task-id="${escapeHtml(context.taskId)}" data-step-id="${escapeHtml(context.stepId)}" aria-label="上移">↑</button><button type="button" data-action="move-order-item" data-direction="down" data-index="${index}" data-task-id="${escapeHtml(context.taskId)}" data-step-id="${escapeHtml(context.stepId)}" aria-label="下移">↓</button></li>`).join('')}</ol>`;
  } else if (['single_choice', 'multiple_choice', 'true_false'].includes(config.type)) {
    const choices = config.type === 'true_false' && !options.length ? ['正确', '错误'] : options;
    control = `<div class="quiz-options">${choices.map((option) => {
      const checked = Array.isArray(answer) ? answer.includes(option) : String(answer) === String(option);
      return `<label class="quiz-option ${checked ? 'is-selected' : ''}"><input type="${config.type === 'multiple_choice' ? 'checkbox' : 'radio'}" name="quiz-${escapeHtml(context.stepId)}" value="${escapeHtml(option)}" ${checked ? 'checked' : ''} ${attributes} /><span>${escapeHtml(option)}</span></label>`;
    }).join('')}</div>`;
  } else {
    control = `<textarea rows="3" placeholder="${escapeHtml(config.placeholder || '写下你的回答…')}" ${attributes}>${escapeHtml(answer || '')}</textarea>`;
  }
  return toolShell(tool, `<p class="activity-question">${escapeHtml(config.question || config.prompt || '请完成这道课程题。')}</p>${control}`, value.checked ? (value.correct ? '已通过' : '待修正') : answer || value.order?.length ? '已作答' : '待作答');
}

function renderBuilder(tool, context) {
  const config = tool.config || {};
  const value = toolState(context.evidence, context.stepId, tool.id);
  const placements = value.placements || {};
  const zones = config.zones?.length ? config.zones : [{ id: 'workspace', label: '作品区' }];
  const boundValue = (binding = {}) => {
    const source = context.allEvidence?.[binding.taskId || context.taskId]
      ?.toolValues?.[binding.stepId]?.[binding.toolId || 'text'];
    let result = binding.fieldId ? source?.fields?.[binding.fieldId] : source?.[binding.property || 'value'];
    if (binding.split === 'sentences') {
      result = String(result || '').split(/[。！？!?；;\n]+/).map((item) => item.trim()).filter(Boolean)[Number(binding.index || 0)];
    }
    if (Array.isArray(result)) result = result.map((item) => typeof item === 'object' ? item.text : item).filter(Boolean).join('；');
    return String(result || '').trim();
  };
  const items = (config.items || []).map((item) => {
    if (typeof item === 'string') return item;
    const binding = config.bindings?.[item.id];
    const courseWork = binding ? boundValue(binding) : '';
    return courseWork ? { ...item, label: `${binding.prefix || ''}${courseWork}` } : item;
  });
  const placedIds = new Set(Object.values(placements).flat());
  return toolShell(tool, `
    <p>${escapeHtml(config.prompt || '把卡片拖入对应区域，形成结构化作品。')}</p>
    <div class="builder-bank" data-builder-bank>${items.filter((item) => !placedIds.has(item.id || item)).map((item) => {
      const id = item.id || item;
      const label = item.label || item;
      return `<button type="button" draggable="true" data-action="select-builder-item" data-builder-item="${escapeHtml(id)}" data-task-id="${escapeHtml(context.taskId)}" data-step-id="${escapeHtml(context.stepId)}">${escapeHtml(label)}</button>`;
    }).join('') || '<span>所有卡片都已放置</span>'}</div>
    <div class="builder-zones">${zones.map((zone) => `<section data-builder-zone="${escapeHtml(zone.id)}" data-task-id="${escapeHtml(context.taskId)}" data-step-id="${escapeHtml(context.stepId)}"><strong>${escapeHtml(zone.label)}</strong><div>${(placements[zone.id] || []).map((id) => { const item = items.find((candidate) => (candidate.id || candidate) === id); return `<button type="button" data-action="return-builder-item" data-item-id="${escapeHtml(id)}" data-zone-id="${escapeHtml(zone.id)}" data-task-id="${escapeHtml(context.taskId)}" data-step-id="${escapeHtml(context.stepId)}">${escapeHtml(item?.label || item || id)} ×</button>`; }).join('')}</div><button class="builder-place" type="button" data-action="place-selected-builder" data-zone-id="${escapeHtml(zone.id)}" data-task-id="${escapeHtml(context.taskId)}" data-step-id="${escapeHtml(context.stepId)}">放到这里</button></section>`).join('')}</div>
  `, `${placedIds.size}/${items.length}`);
}

function renderSimulation(tool, context) {
  const config = tool.config || {};
  const value = toolState(context.evidence, context.stepId, tool.id);
  const history = value.history || [];
  const currentRound = Math.min(history.length + 1, Number(config.rounds || 1));
  const usedChoices = new Set(history.map((entry) => entry.id));
  const roundPrompt = config.roundPrompts?.[currentRound - 1] || config.prompt || '选择本轮方案，运行后观察指标变化。';
  return toolShell(tool, `
    <p>${escapeHtml(roundPrompt)}</p>
    ${Object.keys(config.resources || {}).length ? `<div class="simulation-resources">${Object.entries(config.resources).map(([key, amount]) => `<span><small>${escapeHtml(key)}</small><strong>${escapeHtml(amount)}</strong></span>`).join('')}</div>` : ''}
    <div class="simulation-metrics">${(config.metrics || []).map((metric) => `<span><small>${escapeHtml(metric.label || metric.id)}</small><strong>${escapeHtml(value.metrics?.[metric.id] ?? metric.initialLabel ?? metric.initial ?? 0)}</strong></span>`).join('')}</div>
    <div class="simulation-choices">${(config.choices || []).map((choice) => {
      const unavailable = config.allowRepeat === false && usedChoices.has(choice.id);
      return `<button type="button" class="${value.pendingChoice === choice.id ? 'is-selected' : ''}" data-action="choose-simulation" data-choice-id="${escapeHtml(choice.id)}" data-task-id="${escapeHtml(context.taskId)}" data-step-id="${escapeHtml(context.stepId)}" ${unavailable ? 'disabled' : ''}>${escapeHtml(choice.label)}${unavailable ? '（已运行）' : ''}</button>`;
    }).join('')}</div>
    <button class="activity-action" type="button" data-action="run-simulation" data-task-id="${escapeHtml(context.taskId)}" data-step-id="${escapeHtml(context.stepId)}" ${!value.pendingChoice || history.length >= Number(config.rounds || 1) ? 'disabled' : ''}><i data-lucide="play"></i>运行第 ${currentRound} 轮</button>
    ${history.length ? `<ol class="simulation-history">${history.map((entry, index) => `<li><span>第${index + 1}轮</span>${escapeHtml(entry.label)}<small>${escapeHtml(entry.feedback || '')}</small></li>`).join('')}</ol>` : ''}
  `, `${history.length}/${Number(config.rounds || 1)}轮`);
}

function renderTeam(tool, context) {
  const config = tool.config || {};
  const value = toolState(context.evidence, context.stepId, tool.id);
  const entries = value.entries || [];
  return toolShell(tool, `
    <p>${escapeHtml(config.prompt || '把组内讨论结论记录下来，保留不同意见。')}</p>
    <div class="team-tool-compose">
      ${config.roles?.length ? renderActivitySelect({
        taskId: context.taskId,
        stepId: context.stepId,
        toolId: 'team',
        fieldId: 'selectedRole',
        value: value.selectedRole,
        options: config.roles,
        placeholder: '选择记录角色',
        label: '记录角色',
      }) : ''}
      ${config.recordTypes?.length ? renderActivitySelect({
        taskId: context.taskId,
        stepId: context.stepId,
        toolId: 'team',
        fieldId: 'recordType',
        value: value.recordType,
        options: config.recordTypes,
        placeholder: '选择记录类型',
        label: '记录类型',
      }) : ''}
      <textarea rows="2" placeholder="记录一条观点、分工或证据…" data-activity-field data-task-id="${escapeHtml(context.taskId)}" data-step-id="${escapeHtml(context.stepId)}" data-tool-id="team" data-field-id="draft">${escapeHtml(value.draft || '')}</textarea>
      <button type="button" data-action="add-team-entry" data-task-id="${escapeHtml(context.taskId)}" data-step-id="${escapeHtml(context.stepId)}"><i data-lucide="plus"></i>加入记录</button>
    </div>
    <div class="team-tool-log">${entries.map((entry) => {
      const detail = typeof entry === 'string' ? { text: entry } : entry;
      return `<p><i data-lucide="message-circle-more"></i><span>${detail.role || detail.type ? `<small>${escapeHtml([detail.role, detail.type].filter(Boolean).join(' · '))}</small>` : ''}${escapeHtml(detail.text || '')}</span></p>`;
    }).join('') || '<span>等待第一条组内记录</span>'}</div>
  `, `${entries.length}/${Number(config.minimumEntries || 1)}条`);
}

function renderMedia(tool, context) {
  const config = tool.config || {};
  const value = toolState(context.evidence, context.stepId, tool.id);
  const posterOnly = isPosterOnlyMedia(config);
  const missingVideoSource = config.type === 'video' && !config.url;
  const missingRequiredSource = config.requireCompletion !== false && !config.url && !posterOnly;
  let media = '<div class="media-placeholder"><i data-lucide="play"></i><span>课程素材待配置</span></div>';
  if (config.url && config.type === 'video') media = `<video src="${escapeHtml(config.url)}" poster="${escapeHtml(config.poster || '')}" controls playsinline data-activity-media data-task-id="${escapeHtml(context.taskId)}" data-step-id="${escapeHtml(context.stepId)}"></video>`;
  else if (config.url && config.type === 'audio') media = `<audio src="${escapeHtml(config.url)}" controls data-activity-media data-task-id="${escapeHtml(context.taskId)}" data-step-id="${escapeHtml(context.stepId)}"></audio>`;
  else if (config.url) media = `<img src="${escapeHtml(config.url)}" alt="${escapeHtml(config.title || '课程材料')}" />`;
  else if (config.poster) media = `<figure class="media-poster-fallback"><img src="${escapeHtml(config.poster)}" alt="${escapeHtml(config.title || '课程材料')}预览图" /><figcaption>${posterOnly ? '本课程以情境预览图呈现，不含视频播放。' : missingVideoSource ? '课程视频待补充，目前展示预览图。' : '课程材料待补充，目前展示预览图。'}</figcaption></figure>`;
  const buttonLabel = value.submitting
    ? '正在记录…'
    : value.submitted ? '已记录'
      : missingRequiredSource ? '素材未配置，暂不能完成'
        : posterOnly
          ? value.completed ? '重新确认已查看' : '我已查看情境图'
          : value.completed ? '重新确认已看完' : '我已看完';
  const status = missingRequiredSource
    ? '素材缺失'
    : value.submitted ? '已记录' : value.completed ? '已查看' : posterOnly ? '情境图' : missingVideoSource ? '预览图' : '待查看';
  const prompt = config.prompt || (posterOnly ? '查看情境预览图后再继续。' : '查看课程材料后再继续。');
  return toolShell(tool, `${config.title ? `<p><strong>${escapeHtml(config.title)}</strong></p>` : ''}<p>${escapeHtml(prompt)}</p><div class="activity-media">${media}</div><button class="activity-action" type="button" data-action="complete-media" data-task-id="${escapeHtml(context.taskId)}" data-step-id="${escapeHtml(context.stepId)}" ${missingRequiredSource || value.submitting || value.submitted ? 'disabled' : ''}><i data-lucide="check"></i>${buttonLabel}</button>`, status);
}

function renderScanner(tool, context) {
  const config = tool.config || {};
  const value = toolState(context.evidence, context.stepId, tool.id);
  return toolShell(tool, `
    <p>${escapeHtml(config.prompt || (config.mode === 'object' ? '拍摄或选择一张图片进行课程对象识别。' : '扫描课程二维码；浏览器不支持时可手动输入码值。'))}</p>
    <label class="activity-upload"><i data-lucide="scan-line"></i><span>打开扫描</span><input type="file" accept="image/*" capture="environment" data-scan-file data-task-id="${escapeHtml(context.taskId)}" data-step-id="${escapeHtml(context.stepId)}" /></label>
    ${value.previewUrl ? `<img class="activity-reference" src="${escapeHtml(value.previewUrl)}" alt="本次识别采集图像" />` : ''}
    ${config.allowManualEntry !== false ? `<div class="scanner-manual"><input type="text" value="${escapeHtml(value.manual || '')}" placeholder="手动输入课程码" data-activity-field data-task-id="${escapeHtml(context.taskId)}" data-step-id="${escapeHtml(context.stepId)}" data-tool-id="scanner" data-field-id="manual" /><button type="button" data-action="confirm-scan" data-task-id="${escapeHtml(context.taskId)}" data-step-id="${escapeHtml(context.stepId)}">确认</button></div>` : ''}
    ${value.result ? `<div class="activity-result"><i data-lucide="circle-check-big"></i>识别结果：${escapeHtml(value.result)}</div>` : ''}
  `, value.result ? '已识别' : '待扫描');
}

const RENDERERS = { photo: renderPhoto, audio: renderAudio, text: renderText, sketch: renderSketch, quiz: renderQuiz, builder: renderBuilder, simulation: renderSimulation, team: renderTeam, media: renderMedia, scanner: renderScanner };

export function renderActivityTools({ tools = [], evidence, allEvidence = {}, taskId, stepId }) {
  if (!tools.length) return '<p class="activity-empty">本小步只需按提示观察，完成后确认即可。</p>';
  return `<div class="activity-tools">${tools.map((tool) => RENDERERS[tool.id]?.(tool, { evidence, allEvidence, taskId, stepId }) || '').join('')}</div>`;
}

export function renderCompletedPhotoEditors({ steps = [], evidence, allEvidence = {}, taskId }) {
  return steps.map((step) => {
    const photoTools = (step.tools || []).filter((tool) => tool.id === 'photo');
    if (!photoTools.length) return '';
    const photoValue = toolState(evidence, step.id, 'photo');
    const revision = Number(photoValue.revision || 0);
    const acceptedRevision = Number(photoValue.acceptedRevision ?? -1);
    const requiresRecheck = revision !== acceptedRevision;
    return `<section class="completed-photo-editor" data-completed-photo-step="${escapeHtml(step.id)}">
      ${renderActivityTools({
      tools: photoTools,
      evidence,
      allEvidence,
      taskId,
      stepId: step.id,
      })}
      <p class="task-step-guide__validation">${requiresRecheck
    ? '照片有修改，需重新检查这一步后才能提交整个任务。'
    : '当前照片已通过本步检查；仍可删除、重拍或补拍。'}</p>
      <button class="task-step-button" type="button" data-action="complete-activity-step"
        data-task-id="${escapeHtml(taskId)}" data-step-id="${escapeHtml(step.id)}" ${photoValue.revisionSubmitting ? 'disabled' : ''}>
        <i data-lucide="check"></i>${photoValue.revisionSubmitting ? '正在重新检查…' : requiresRecheck ? '保存并重新检查这一步' : '再次检查这一步'}
      </button>
    </section>`;
  }).join('');
}

function populated(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value != null && (typeof value !== 'string' || value.trim().length > 0);
}

export function validateActivityStep({ tools = [], evidence, stepId }) {
  for (const tool of tools) {
    const value = toolState(evidence, stepId, tool.id);
    if (tool.id === 'photo') {
      const count = Number(value.count ?? value.imageUrls?.length ?? evidence.imageUrls?.length ?? 0);
      if (value.processing) return '照片仍在准备中，请稍等片刻。';
      if (count < Number(tool.config?.minCount || 1)) return `还需要拍摄 ${Number(tool.config?.minCount || 1) - count} 张照片。`;
      if (count > Number(tool.config?.maxCount || Infinity)) return `本小步最多提交 ${tool.config.maxCount} 张照片。`;
    }
    if (tool.id === 'audio' && Number(value.durationSeconds || 0) < Number(tool.config?.minSeconds || 3)) return `录音至少需要 ${tool.config?.minSeconds || 3} 秒。`;
    if (tool.id === 'audio' && Number(value.durationSeconds || 0) > Number(tool.config?.maxSeconds || Infinity)) return `录音不能超过 ${tool.config.maxSeconds} 秒。`;
    if (tool.id === 'text') {
      const missing = (tool.config?.fields || []).find((field) => field.required && !populated(value.fields?.[field.id]));
      if (missing) return `请填写“${missing.label}”。`;
      const tooShort = (tool.config?.fields || []).find((field) => Number(field.minLength || 0) > String(value.fields?.[field.id] ?? '').trim().length);
      if (tooShort) return `“${tooShort.label}”至少需要 ${tooShort.minLength} 个字。`;
      const tooLong = (tool.config?.fields || []).find((field) => Number(field.maxLength || Infinity) < String(value.fields?.[field.id] ?? '').trim().length);
      if (tooLong) return `“${tooLong.label}”最多填写 ${tooLong.maxLength} 个字。`;
    }
    if (tool.id === 'sketch' && !value.dataUrl) return '请先在画板上完成标注或绘制。';
    if (tool.id === 'quiz') {
      const answer = tool.config?.type === 'ordering' ? value.order : value.answer;
      if (!populated(answer) && !(Array.isArray(answer) && answer.length)) return '请先完成答题。';
      if (Number(tool.config?.minLength || 0) > String(answer ?? '').trim().length) return `回答至少需要 ${tool.config.minLength} 个字。`;
      if (tool.config?.answer != null) {
        const expected = Array.isArray(tool.config.answer) ? tool.config.answer.join('|') : String(tool.config.answer);
        const actual = Array.isArray(answer) ? answer.join('|') : String(answer);
        if (expected !== actual) return tool.config?.retryMessage || '这个答案还需要再核对一次。';
      }
    }
    if (tool.id === 'builder') {
      const placed = Object.values(value.placements || {}).flat().length;
      if (placed < (tool.config?.items || []).length) return '还有卡片没有放入作品区。';
      const missingZone = Object.entries(tool.config?.zoneMinimums || {}).find(([zoneId, minimum]) => (value.placements?.[zoneId] || []).length < Number(minimum));
      if (missingZone) {
        const zone = tool.config?.zones?.find((item) => item.id === missingZone[0]);
        return `“${zone?.label || missingZone[0]}”至少需要 ${missingZone[1]} 张卡片。`;
      }
    }
    if (tool.id === 'simulation') {
      if ((value.history || []).length < Number(tool.config?.rounds || 1)) return '请完成所有推演轮次。';
      if (tool.config?.allowRepeat === false && new Set((value.history || []).map((entry) => entry.id)).size !== (value.history || []).length) return '每轮请选择不同的推演分支。';
    }
    if (tool.id === 'team') {
      if ((value.entries || []).length < Number(tool.config?.minimumEntries || 1)) return `请至少保留 ${tool.config?.minimumEntries || 1} 条组内记录。`;
      if (tool.config?.roles?.length && (value.entries || []).some((entry) => typeof entry !== 'object' || !entry.role)) return '请为每条组内记录标明贡献角色。';
      const recordedTypes = new Set((value.entries || []).map((entry) => typeof entry === 'string' ? '' : entry.type));
      const missingType = (tool.config?.requiredRecordTypes || []).find((type) => !recordedTypes.has(type));
      if (missingType) return `还需要一条“${missingType}”记录。`;
    }
    if (tool.id === 'media' && tool.config?.requireCompletion !== false) {
      const posterOnly = isPosterOnlyMedia(tool.config);
      if (!tool.config?.url && !posterOnly) {
        return '课程素材尚未配置，请联系老师。';
      }
      if (!value.completed) return posterOnly ? '请先查看课程情境图。' : '请先查看完课程材料。';
    }
    if (tool.id === 'scanner' && !value.result) return '请先完成扫码或识别。';
  }
  return '';
}

export function validateCompletedTaskSteps({ task, evidence }) {
  for (const [stepIndex, step] of (task?.steps || []).entries()) {
    const tools = step.tools?.length ? step.tools : (task.tools || []);
    if (!tools.length) continue;
    const error = validateActivityStep({ tools, evidence, stepId: step.id });
    if (error) {
      return {
        stepId: step.id,
        stepIndex,
        message: `第 ${stepIndex + 1} 步“${step.studentAction || step.objective || step.id}”：${error}`,
      };
    }
    const photo = tools.some((tool) => tool.id === 'photo')
      ? toolState(evidence, step.id, 'photo')
      : null;
    if (
      step.completionMode === 'ai_evaluation'
      && photo
      && Number(photo.revision || 0) !== Number(photo.acceptedRevision ?? -1)
    ) {
      return {
        stepId: step.id,
        stepIndex,
        message: `第 ${stepIndex + 1} 步的照片已经修改，请先点击“保存并重新检查这一步”。`,
      };
    }
  }
  return null;
}

export function serializableToolValues(evidence) {
  return JSON.parse(JSON.stringify(evidence.toolValues || {}, (key, value) => (
    [
      'recorder', 'recognition', 'stream', 'blob', 'url', 'dataUrl', 'dataUrls',
      'imageUrls', 'previewUrl', 'files', 'autoStopTimer', 'acceptedRevision',
      'revisionSubmitting',
    ].includes(key) ? undefined : value
  )));
}
