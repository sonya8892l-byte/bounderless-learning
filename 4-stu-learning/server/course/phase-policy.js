const SECTION_GROUPS = Object.freeze({
  objective: Object.freeze(['阶段目标']),
  behavior: Object.freeze([
    '絮絮行为',
    '絮絮在本阶段的工作方式',
    '对话结构',
    '每轮固定流程',
    '讨论顺序',
    '核心问题顺序',
    '产出格式',
    '评价方式',
  ]),
  roleGuidance: Object.freeze(['角色行为差异', '角色关注点']),
  constraints: Object.freeze(['禁止行为', '知识与来源规则', '强制展示标签']),
  transition: Object.freeze(['转场条件', '完成条件']),
  opening: Object.freeze(['开场白模板', '开场模板', '主持话术', '结束语模板', '汇报模板']),
  phrases: Object.freeze(['关键提示词']),
});

const TITLE_TO_GROUP = Object.freeze(Object.fromEntries(
  Object.entries(SECTION_GROUPS).flatMap(([group, titles]) => titles.map((title) => [title, group])),
));

function normalize(value = '') {
  return String(value).replace(/\r\n?/g, '\n').trim();
}

function markdownSections(markdown = '') {
  const source = normalize(markdown);
  const headings = [...source.matchAll(/^##\s+(.+?)\s*$/gm)];
  return headings.map((heading, index) => ({
    title: heading[1].trim(),
    line: source.slice(0, heading.index).split('\n').length,
    content: source.slice(
      heading.index + heading[0].length,
      headings[index + 1]?.index ?? source.length,
    ).trim(),
  }));
}

function append(target, key, value) {
  if (!value) return;
  target[key] = target[key] ? `${target[key]}\n\n${value}` : value;
}

/**
 * 把 Phase Markdown 编译成运行时真正消费的语义字段。
 *
 * 旧课程若没有二级标题，保留全文兼容，不再用字符下标硬切；同时返回 warning，
 * 让课程作者知道它仍处于兼容模式。结构化课程只装配会影响当前回合的规则，长篇
 * 开场脚本与口头禅另存字段，避免每轮重复注入后诱发复读。
 */
export function compilePhasePolicy(markdown = '', { file = '' } = {}) {
  const source = normalize(markdown);
  const sections = markdownSections(source);
  const policy = {
    mode: sections.length ? 'structured' : 'compat',
    objective: '',
    behavior: '',
    roleGuidance: '',
    constraints: '',
    transition: '',
    opening: '',
    phrases: '',
    compatibilityText: '',
    unknownSections: [],
    warnings: [],
  };

  if (!source) return Object.freeze(policy);
  if (!sections.length) {
    policy.compatibilityText = source;
    policy.warnings.push({
      code: 'phase_prompt_unstructured',
      level: 'warning',
      file,
      line: 1,
      message: 'Phase 提示没有结构化二级标题，运行时暂按全文兼容装配；请迁移为阶段目标、絮絮行为、禁止行为和转场条件。',
    });
    return Object.freeze(policy);
  }

  for (const section of sections) {
    const group = TITLE_TO_GROUP[section.title];
    if (group) append(policy, group, section.content);
    else {
      policy.unknownSections.push(Object.freeze(section));
      policy.warnings.push({
        code: 'phase_prompt_unknown_section',
        level: 'warning',
        file,
        line: section.line,
        message: `Phase 提示中的“${section.title}”没有运行时语义，已忽略；请迁移到受支持的结构化章节。`,
      });
    }
  }
  if (!policy.objective || !policy.constraints || !policy.transition) {
    policy.warnings.push({
      code: 'phase_prompt_missing_core_section',
      level: 'warning',
      file,
      line: 1,
      message: 'Phase 提示缺少“阶段目标 / 禁止行为 / 转场条件”中的一个或多个核心字段。',
    });
  }
  return Object.freeze({
    ...policy,
    unknownSections: Object.freeze(policy.unknownSections),
    warnings: Object.freeze(policy.warnings),
  });
}

/**
 * 只渲染当前每轮真正需要的 Phase 规则。开场模板与关键口头禅不会在普通回合反复注入；
 * 若未来需要开场脚本，应由明确的 phase_started TurnPlan 单独取 opening。
 */
export function phasePolicyInstructions(policy = null) {
  if (!policy) return '';
  if (policy.mode === 'compat') return String(policy.compatibilityText || '').trim();
  return [
    policy.objective ? `[阶段目标]\n${policy.objective}` : '',
    policy.behavior ? `[本阶段工作方式]\n${policy.behavior}` : '',
    policy.roleGuidance ? `[角色差异]\n${policy.roleGuidance}` : '',
    policy.constraints ? `[本阶段禁止与边界]\n${policy.constraints}` : '',
    policy.transition ? `[转场条件]\n${policy.transition}` : '',
  ].filter(Boolean).join('\n\n');
}
