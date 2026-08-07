import { mergeDefaults } from './platform-defaults.js';

export const TOOL_NAME_DEFAULTS = Object.freeze({
  photo: '拍照采集',
  audio: '语音记录',
  text: '文字表单',
  sketch: '画板标注',
  quiz: '答题评测',
  builder: '拼合搭建',
  simulation: '沙盘推演',
  team: '团队协作',
  media: '沉浸媒体',
  scanner: '扫码识别',
});

export const TOOL_FIELD_LABEL_DEFAULTS = Object.freeze({
  'text.observation': '观察记录',
});

const TOOL_DEFAULTS_FALLBACK = Object.freeze({
  filename: 'tool-defaults.md',
  declaration: Object.freeze({
    overridable: true,
    merge: 'by-key',
    courseField: '工具缺省',
    locked: Object.freeze([]),
  }),
  entries: Object.freeze({ ...TOOL_NAME_DEFAULTS, ...TOOL_FIELD_LABEL_DEFAULTS }),
  sections: Object.freeze({}),
  markdown: '',
});

/** 把 tool-defaults.md 解析成显示名与缺省字段 label。缺失时回落到代码常量。 */
export function resolveToolDefaults(document, courseOverrides = {}) {
  const { entries, warnings } = mergeDefaults(document || TOOL_DEFAULTS_FALLBACK, courseOverrides);
  const names = {};
  for (const id of Object.keys(TOOL_NAME_DEFAULTS)) {
    names[id] = entries[id] || TOOL_NAME_DEFAULTS[id];
  }
  const fieldLabels = {};
  for (const key of Object.keys(TOOL_FIELD_LABEL_DEFAULTS)) {
    fieldLabels[key] = entries[key] || TOOL_FIELD_LABEL_DEFAULTS[key];
  }
  return {
    toolDefaults: Object.freeze({
      names: Object.freeze(names),
      fieldLabels: Object.freeze(fieldLabels),
    }),
    warnings,
  };
}
