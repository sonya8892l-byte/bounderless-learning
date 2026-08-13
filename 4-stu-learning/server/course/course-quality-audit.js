/**
 * 课程语义质量审计（纯函数）。
 *
 * 这里检查“结构合法但会造成教学或运行时偏差”的配置。输入是 compileCourse
 * 产物，输出带稳定 code 的 issue；不修改课程，也不替代 parser/compiler。
 */

import {
  matchesProtectedMatchers,
  protectedTerms as extractProtectedTerms,
} from './projections.js';
import { resolveStepRestrictions } from './restriction-sections.js';

/**
 * 仅用于作者审阅的可维护性阈值。运行时会装配完整结构化 Phase 语义，不按此值截断。
 */
export const PHASE_PROMPT_AUTHORING_BUDGET = 2000;

/** @deprecated 兼容早期测试/调用方；语义已改为作者审阅阈值。 */
export const PHASE_PROMPT_CHAR_BUDGET = PHASE_PROMPT_AUTHORING_BUDGET;

export const QUALITY_ISSUE_CODES = Object.freeze([
  'unknown_course_section',
  'protected_scaffold_leak',
  'unsafe_student_action',
  'phase_prompt_over_budget',
  'stale_phase_capability',
  'timing_conflict',
]);

/** 与 parseLesson / compileCourse 当前实际读取的 course.md 二级标题保持一致。 */
export const KNOWN_COURSE_SECTIONS = Object.freeze([
  '基本信息',
  '核心问题',
  '学生端角色体系',
  '学习视图',
  '学生端视觉素材',
  '课程目标体系',
  '阶段编排',
  '课程限制规则',
  '人设侧重',
  '话术覆盖',
  '脚手架',
  '组织信息',
  '学段规范',
  '工具默认',
  '工具缺省',
  '数值默认',
  '数值缺省',
]);

const UNSAFE_ACTION_PATTERNS = Object.freeze([
  { id: 'touch_exhibit', label: '触摸展品或文物', re: /(?:摸摸看|触摸|触碰|用手摸)(?:.{0,10}(?:展品|文物|螭首|石头|雕刻|材质))?/g },
  { id: 'pour_water', label: '向地面倒水', re: /(?:(?:在|往|向)地面(?:上)?|往地上)?倒(?:点)?水(?:验证|试验|试试)?/g },
  { id: 'throw_in_water', label: '向水中投放物体', re: /(?:向|往|朝)(?:河|水)(?:中|里|面)?(?:投放|投入|扔|丢|抛)|(?:把|将).{0,12}(?:投入|扔进|丢进)(?:河|水)/g },
  { id: 'phone_near_water', label: '近水操作手机', re: /靠近水边.{0,12}(?:手机|拍照|摄像|录像)|(?:手机|拍照|摄像).{0,12}靠近水边|在水边(?:用|操作)(?:手机|相机)/g },
  { id: 'cross_barrier', label: '翻越护栏或栏杆', re: /(?:跨|翻|爬|攀|越).{0,10}(?:护栏|栏杆|石栏|围栏)/g },
]);

const STALE_CAPABILITY_PATTERNS = Object.freeze([
  { label: '扫码领取或分配角色', re: /扫码(?:领取|获得|分配|确认).{0,8}角色(?:卡)?|扫一扫.{0,10}(?:领取|获得|分配).{0,6}角色(?:卡)?/g },
  { label: '平台自动聚合班级或小组成果', re: /自动(?:聚合|汇总|收齐).{0,10}(?:全班|小组|整班|整组|进度|成果|结果|证据)|(?:全班|小组|整班|整组)(?:自动)?聚合/g },
  { label: '收集物自动解锁阶段', re: /(?:集齐|收齐).{0,28}(?:解锁|进入\s*Phase\s*\d+)/gi },
]);

function clean(value = '') {
  return String(value || '').trim();
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function courseFile(courseId) {
  return `6-lessons/${courseId}/course.md`;
}

function roleFile(courseId, roleId) {
  return `6-lessons/${courseId}/roles/${roleId}.md`;
}

function phasesFile(courseId, course = null) {
  const source = course?.documentSources?.['phases.md']?.sourceFile || 'phases.md';
  return `6-lessons/${courseId}/${source}`;
}

function findLine(markdown = '', needle = '') {
  const target = clean(needle);
  if (!target) return 1;
  const lines = String(markdown || '').split('\n');
  const index = lines.findIndex((line) => line.includes(target));
  return index === -1 ? 1 : index + 1;
}

function findHeadingLine(markdown = '', title = '') {
  const pattern = new RegExp(`^##\\s+${escapeRegExp(title)}\\s*$`);
  const lines = String(markdown || '').split('\n');
  const index = lines.findIndex((line) => pattern.test(line));
  return index === -1 ? 1 : index + 1;
}

function taskPhaseId(task = {}) {
  if (/^phase-\d+$/.test(clean(task.phaseId))) return clean(task.phaseId);
  const raw = clean(task.phase);
  const match = raw.match(/Phase\s*(\d+)/i) || raw.match(/phase-(\d+)/i);
  return match ? `phase-${match[1]}` : '';
}

function listPhasePromptEntries(course = {}) {
  const entries = Object.entries(course.files || {})
    .filter(([name]) => /^prompts\/phase\d+-.+\.md$/.test(name))
    .map(([name, markdown]) => ({
      phaseId: `phase-${name.match(/phase(\d+)/)?.[1]}`,
      file: `6-lessons/${course.id}/${name}`,
      markdown: String(markdown || ''),
    }));
  if (entries.length) return entries;
  return Object.entries(course.phasePrompts || {}).map(([phaseId, markdown]) => ({
    phaseId,
    file: `6-lessons/${course.id}/prompts/`,
    markdown: String(markdown || ''),
  }));
}

function scaffoldEntries(markdown = '') {
  const source = String(markdown || '');
  const entries = [];
  for (const match of source.matchAll(/^\s*\|\s*(L[0-4])\s*\|\s*(.*?)\s*\|\s*$/gmi)) {
    entries.push({ level: match[1].toUpperCase(), text: clean(match[2]), needle: clean(match[2]).slice(0, 40) });
  }
  for (const match of source.matchAll(/^\s*[-*]\s*(L[0-4])\s*[：:]\s*(.+?)\s*$/gmi)) {
    entries.push({ level: match[1].toUpperCase(), text: clean(match[2]), needle: clean(match[2]).slice(0, 40) });
  }
  if (!entries.length && clean(source)) {
    entries.push({ level: '脚手架', text: clean(source), needle: clean(source).slice(0, 40) });
  }
  return entries;
}

function protectedTermsForRefs(course, refs = []) {
  const terms = new Set();
  for (const restrictionRef of refs.map(clean).filter(Boolean)) {
    const resolved = resolveStepRestrictions(course, { restrictionRef });
    for (const item of resolved) {
      for (const term of extractProtectedTerms(item.text || '')) terms.add(term);
      for (const rule of course.restrictions || []) {
        if (
          item.title === rule.name
          || item.text?.includes(rule.name)
          || item.text?.includes(rule.protectedContent)
        ) {
          for (const term of rule.protectedTerms || []) terms.add(clean(term));
        }
      }
    }
  }
  return [...terms]
    .filter((term) => term && (/\d/.test(term) ? term.length >= 2 : term.length >= 4))
    .sort((a, b) => b.length - a.length);
}

function protectedRulesForRefs(course, refs = []) {
  const rules = new Map();
  for (const restrictionRef of refs.map(clean).filter(Boolean)) {
    const resolved = resolveStepRestrictions(course, { restrictionRef });
    for (const item of resolved) {
      for (const rule of course.restrictions || []) {
        if (
          item.title === rule.name
          || item.text?.includes(rule.name)
          || item.text?.includes(rule.protectedContent)
        ) rules.set(rule.id || rule.name, rule);
      }
    }
  }
  return [...rules.values()];
}

function protectiveFraming(text = '') {
  return /(?:不要|不得|不能|禁止|严禁|避免|不可|不向|不对|不直接)[^。！？\n]{0,36}(?:透露|告诉|公布|给出|说出|回答|揭示)/u.test(String(text || ''))
    || /(?:^|[^一-鿿])(?:不说|不提|不列出|不公布|不揭示)[^。！？\n]{0,36}(?:概念|答案|结论|数值|路径|内容|功能|“|")/u.test(String(text || ''));
}

function semanticAuditFragments(text = '') {
  return String(text || '')
    .split(/[\n。！？；;]+/u)
    .map(clean)
    .filter(Boolean);
}

/**
 * 隐私限制里的“姓名/联系方式”等类别可以出现在删除、脱敏指令中；这种写法在
 * 保护数据，未向学生展示具体受保护值。概念答案的普通否定不在豁免范围内。
 */
function isProtectiveRemoval(text = '', term = '') {
  const escaped = escapeRegExp(term);
  return new RegExp(`(?:删除|去除|移除|隐去|隐藏|遮挡|打码|脱敏|不收集|不得收集|不要收集|无).{0,12}${escaped}`).test(text)
    || new RegExp(`${escaped}.{0,12}(?:不进入|不上传|不公开|须删除|要删除|需删除|去标识)`).test(text);
}

function visibleToolStrings(tool = {}) {
  const config = tool.config || {};
  const values = [
    tool.name,
    tool.module,
    config.prompt,
    config.title,
    config.question,
    config.placeholder,
    ...(config.roundPrompts || []),
    ...(config.roles || []),
    ...(config.recordTypes || []),
    ...(config.options || []).map((option) => (typeof option === 'string' ? option : option?.label)),
    ...(config.fields || []).flatMap((field) => [
      field?.label,
      field?.placeholder,
      ...(field?.options || []).map((option) => (typeof option === 'string' ? option : option?.label)),
    ]),
    ...(config.items || []).map((item) => (typeof item === 'string' ? item : item?.label)),
    ...(config.zones || []).map((zone) => zone?.label),
    ...Object.values(config.bindings || {}).map((binding) => binding?.prefix),
    ...Object.keys(config.resources || {}),
    ...(config.metrics || []).flatMap((metric) => [metric?.label, metric?.initialLabel]),
    ...(config.choices || []).flatMap((choice) => [choice?.label, choice?.feedback]),
  ];
  return values.map(clean).filter(Boolean);
}

function studentVisibleTexts(task = {}, step = null) {
  if (step) {
    return [
      step.title,
      step.objective,
      step.studentAction,
      step.evidenceRequirement,
      step.acceptance,
      step.inlineAcceptance,
      step.guidance,
      step.scaffold,
      ...(step.tools || []).flatMap(visibleToolStrings),
    ].map(clean).filter(Boolean);
  }
  return [
    task.name,
    task.requirement,
    task.passCondition,
    task.evidenceRequirement,
    task.inlineGuidance || task.guidance,
    task.inlineScaffold || task.scaffold,
    task.inlineAcceptance || task.acceptance,
    task.guide,
    ...(task.tools || []).flatMap(visibleToolStrings),
  ].map(clean).filter(Boolean);
}

function isSafetyNegated(text, index) {
  const before = String(text || '').slice(Math.max(0, index - 24), index);
  return /(?:不得|不要|请勿|切勿|严禁|禁止|避免|无需|不用|不能|不可|别|勿|不(?:引导|指导|要求|允许|建议)).{0,20}$/.test(before);
}

function isCapabilityNegated(text, index) {
  const before = String(text || '').slice(Math.max(0, index - 28), index);
  return /(?:不会|不提供|不支持|不能|不得|不要|尚未|未接入|无法).{0,20}$/.test(before);
}

function unsafeHits(text = '') {
  const hits = [];
  for (const pattern of UNSAFE_ACTION_PATTERNS) {
    const regex = new RegExp(pattern.re.source, pattern.re.flags);
    for (const match of String(text || '').matchAll(regex)) {
      if (isSafetyNegated(text, match.index)) continue;
      hits.push({ id: pattern.id, label: pattern.label, snippet: clean(match[0]) });
    }
  }
  return hits;
}

function promptDisclosureHits(text = '', terms = []) {
  const source = String(text || '');
  const hits = [];
  for (const term of terms.map(clean).filter(Boolean)) {
    const escaped = escapeRegExp(term);
    const patterns = [
      new RegExp(`(?:告诉|直接说|直接给|输出|展示|揭示|公布|回答)(?:给|向)?(?:学生)?[^。！？\\n]{0,24}${escaped}`, 'g'),
      new RegExp(`(?:答案|结论)[^。！？\\n]{0,8}(?:是|为)[^。！？\\n]{0,8}${escaped}`, 'g'),
    ];
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const before = source.slice(Math.max(0, match.index - 24), match.index);
        if (/(?:不要|不得|不能|禁止|严禁|避免|不可|不向|不对|不直接).{0,20}$/.test(before)) continue;
        hits.push({ term, snippet: clean(match[0]) });
      }
    }
  }
  return hits;
}

function restrictionLockedInPhase(restriction = {}, phaseId = '') {
  const current = Number(String(phaseId).match(/phase-(\d+)/i)?.[1]);
  const unlock = Number(String(restriction.unlockWhen || '').match(/Phase\s*(\d+)/i)?.[1]);
  if (Number.isFinite(current) && Number.isFinite(unlock) && current >= unlock) return false;
  return true;
}

function issueBase(courseId, fields) {
  return {
    course: courseId,
    courseId,
    roleId: '',
    stepId: '',
    phaseId: '',
    ...fields,
  };
}

function phaseIdAt(markdown = '', index = 0) {
  const headings = [...String(markdown || '').slice(0, index).matchAll(/^##\s*Phase\s*(\d+)/gmi)];
  const last = headings.at(-1);
  return last ? `phase-${last[1]}` : '';
}

function idleMentions(markdown = '') {
  const source = String(markdown || '');
  const hits = [];
  const patterns = [
    /(\d+)\s*(分钟|分|min)[^。\n]{0,16}无(?:操作|活动)/gi,
    /无(?:操作|活动)[^。\n]{0,16}(\d+)\s*(分钟|分|min)/gi,
  ];
  for (const regex of patterns) {
    for (const match of source.matchAll(regex)) {
      hits.push({ index: match.index, minutes: Number(match[1]), snippet: clean(match[0]) });
    }
  }
  return hits;
}

/**
 * @param {object} course compileCourse 产物
 * @returns {{issues: Array<object>}}
 */
export function auditCourseQuality(course, options = {}) {
  const courseId = options.courseId || course?.id || 'unknown';
  const files = course?.files || {};
  const courseMarkdown = files['course.md'] || '';
  const phasesMarkdown = files['phases.md'] || '';
  const issues = [];
  const dedupe = new Set();

  const push = (fields) => {
    const key = `${fields.code}:${fields.file}:${fields.line || 1}:${fields.roleId || ''}:${fields.stepId || ''}:${fields.message}`;
    if (dedupe.has(key)) return;
    dedupe.add(key);
    issues.push(issueBase(courseId, { line: 1, ...fields }));
  };

  const knownSections = new Set(KNOWN_COURSE_SECTIONS);
  for (const match of courseMarkdown.matchAll(/^##\s+(.+?)\s*$/gm)) {
    const title = clean(match[1]);
    if (!title || knownSections.has(title)) continue;
    push({
      level: 'error',
      code: 'unknown_course_section',
      message: `course.md 二级标题「${title}」当前没有编译消费者，内容不会进入运行时配置。修复：将字段移入受支持小节，或把纯说明迁到 README/SPEC。`,
      file: courseFile(courseId),
      line: findHeadingLine(courseMarkdown, title),
    });
  }

  const auditLeak = ({ roleId, task, step, sourceMarkdown, sourceFile, refs }) => {
    const terms = protectedTermsForRefs(course, refs);
    const rules = protectedRulesForRefs(course, refs);
    if (!terms.length && !rules.length) return;
    for (const text of studentVisibleTexts(task, step)) {
      for (const fragment of semanticAuditFragments(text)) {
        const protectsAnswer = protectiveFraming(fragment);
        const leaked = protectsAnswer
          ? null
          : terms.find((term) => fragment.includes(term) && !isProtectiveRemoval(fragment, term));
        const semanticRule = protectsAnswer
          ? null
          : rules.find((rule) => matchesProtectedMatchers(fragment, rule.protectedMatchers || []));
        if (!leaked && !semanticRule) continue;
        const protectedLabel = leaked || semanticRule.name;
        push({
          level: 'error',
          code: 'protected_scaffold_leak',
          message: `学生可见引导或任务文案泄露受保护内容「${protectedLabel}」。修复：改为观察问题或证据框架，待 course.md / 课程限制规则的解除条件满足后再揭示。`,
          file: sourceFile || roleFile(courseId, roleId),
          line: findLine(sourceMarkdown, leaked || clean(fragment).slice(0, 40)),
          roleId,
          stepId: step?.id || '',
          phaseId: taskPhaseId(task),
        });
      }
    }
  };

  const auditUnsafe = ({ roleId, task, step, sourceMarkdown, sourceFile }) => {
    for (const text of studentVisibleTexts(task, step)) {
      for (const hit of unsafeHits(text)) {
        push({
          level: 'warning',
          code: 'unsafe_student_action',
          message: `学生可见内容出现高置信危险操作「${hit.label}」（${hit.snippet}）。修复：改成安全观察法，并保留必要的简短安全边界。`,
          file: sourceFile || roleFile(courseId, roleId),
          line: findLine(sourceMarkdown, hit.snippet),
          roleId,
          stepId: step?.id || '',
          phaseId: taskPhaseId(task),
        });
      }
    }
  };

  for (const role of course.roles || []) {
    const sourceMarkdown = role.sourceMarkdown || files[`roles/${role.id}.md`] || '';
    const sourceFile = roleFile(courseId, role.id);
    for (const task of role.tasks || []) {
      const taskRefs = [
        task.restrictionRef,
        ...(task.steps || []).map((step) => step.restrictionRef),
      ];
      auditLeak({ roleId: role.id, task, step: null, sourceMarkdown, sourceFile, refs: taskRefs });
      auditUnsafe({ roleId: role.id, task, step: null, sourceMarkdown, sourceFile });
      for (const step of task.steps || []) {
        auditLeak({
          roleId: role.id,
          task,
          step,
          sourceMarkdown,
          sourceFile,
          refs: [step.restrictionRef || task.restrictionRef],
        });
        auditUnsafe({ roleId: role.id, task, step, sourceMarkdown, sourceFile });
      }
    }
  }

  // `phases.md / ### 阶段任务N` 与角色任务共用同一套学生可见边界。
  // 只审角色文件会让选择角色前的脚手架泄题或危险动作成为盲区。
  for (const phase of Object.values(course.phaseTracks || {})) {
    for (const task of phase.tasks || []) {
      const taskRefs = [
        task.restrictionRef,
        ...(task.steps || []).map((step) => step.restrictionRef),
      ];
      auditLeak({
        roleId: '', task, step: null, sourceMarkdown: phasesMarkdown,
        sourceFile: phasesFile(courseId, course), refs: taskRefs,
      });
      auditUnsafe({
        roleId: '', task, step: null, sourceMarkdown: phasesMarkdown,
        sourceFile: phasesFile(courseId, course),
      });
      for (const step of task.steps || []) {
        auditLeak({
          roleId: '', task, step, sourceMarkdown: phasesMarkdown,
          sourceFile: phasesFile(courseId, course),
          refs: [step.restrictionRef || task.restrictionRef],
        });
        auditUnsafe({
          roleId: '', task, step, sourceMarkdown: phasesMarkdown,
          sourceFile: phasesFile(courseId, course),
        });
      }
    }
  }

  const promptEntries = listPhasePromptEntries(course);
  for (const entry of promptEntries) {
    const length = [...entry.markdown].length;
    if (length > PHASE_PROMPT_AUTHORING_BUDGET) {
      push({
        level: 'warning',
        code: 'phase_prompt_over_budget',
        message: `Phase 提示共 ${length} 字，超过 ${PHASE_PROMPT_AUTHORING_BUDGET} 字作者审阅阈值。运行时仍装配完整内容。修复：按阶段目标、边界和转场压缩重复说明，细节下沉到任务/Step。`,
        file: entry.file,
        phaseId: entry.phaseId,
      });
    }

    const lockedProtectedTerms = [...new Set((course.restrictions || [])
      .filter((restriction) => restrictionLockedInPhase(restriction, entry.phaseId))
      .flatMap((restriction) => restriction.protectedTerms || [])
      .map(clean)
      .filter(Boolean))];
    const lockedProtectedRules = (course.restrictions || [])
      .filter((restriction) => restrictionLockedInPhase(restriction, entry.phaseId));
    for (const hit of promptDisclosureHits(entry.markdown, lockedProtectedTerms)) {
      push({
        level: 'error',
        code: 'protected_scaffold_leak',
        message: `Phase 提示正向要求向学生揭示受保护内容「${hit.term}」（${hit.snippet}）。修复：保留为内部边界或观察问题，不得要求模型直接说出答案。`,
        file: entry.file,
        line: findLine(entry.markdown, hit.snippet),
        phaseId: entry.phaseId,
      });
    }
    for (const sentence of String(entry.markdown).split(/[。！？\n]+/u)) {
      if (!/(?:告诉|直接说|直接给|输出|展示|揭示|公布|回答)/u.test(sentence)) continue;
      if (protectiveFraming(sentence)) continue;
      const rule = lockedProtectedRules.find((candidate) => (
        matchesProtectedMatchers(sentence, candidate.protectedMatchers || [])
      ));
      if (!rule) continue;
      push({
        level: 'error',
        code: 'protected_scaffold_leak',
        message: `Phase 提示正向要求向学生揭示受保护内容「${rule.name}」。修复：保留为内部边界或观察问题，不得要求模型直接说出答案。`,
        file: entry.file,
        line: findLine(entry.markdown, clean(sentence).slice(0, 40)),
        phaseId: entry.phaseId,
      });
    }
    for (const hit of unsafeHits(entry.markdown)) {
      push({
        level: 'warning',
        code: 'unsafe_student_action',
        message: `Phase 提示出现高置信危险操作「${hit.label}」（${hit.snippet}）。修复：改成安全观察法，并保留必要的简短安全边界。`,
        file: entry.file,
        line: findLine(entry.markdown, hit.snippet),
        phaseId: entry.phaseId,
      });
    }

  }

  const capabilitySources = [
    ...promptEntries,
    { phaseId: '', file: phasesFile(courseId, course), markdown: phasesMarkdown },
  ];
  for (const entry of capabilitySources) {
    for (const pattern of STALE_CAPABILITY_PATTERNS) {
      const regex = new RegExp(pattern.re.source, pattern.re.flags);
      for (const match of entry.markdown.matchAll(regex)) {
        if (isCapabilityNegated(entry.markdown, match.index)) continue;
        if (pattern.label === '收集物自动解锁阶段' && /老师|教师|手动/.test(match[0])) continue;
        push({
          level: 'warning',
          code: 'stale_phase_capability',
          message: `课程内容声明「${pattern.label}」（${clean(match[0])}），当前运行时不提供该自动行为。修复：改成现行角色选择、学生提交或教师推进流程。`,
          file: entry.file,
          line: findLine(entry.markdown, match[0]),
          phaseId: entry.phaseId,
        });
      }
    }
  }

  const narrativeSources = [
    ...promptEntries,
    { phaseId: '', file: phasesFile(courseId, course), markdown: phasesMarkdown },
  ];
  for (const source of narrativeSources) {
    for (const mention of idleMentions(source.markdown)) {
      const phaseId = source.phaseId || phaseIdAt(source.markdown, mention.index);
      if (!phaseId || !Number.isFinite(mention.minutes)) continue;
      const configured = [];
      for (const role of course.roles || []) {
        for (const task of role.tasks || []) {
          if (taskPhaseId(task) === phaseId && Number.isFinite(Number(task.timing?.idleNudgeSeconds))) {
            configured.push(Number(task.timing.idleNudgeSeconds));
          }
        }
      }
      for (const phase of course.lesson?.phases || []) {
        if (phase.id !== phaseId) continue;
        for (const task of phase.tasks || []) {
          if (Number.isFinite(Number(task.timing?.idleNudgeSeconds))) {
            configured.push(Number(task.timing.idleNudgeSeconds));
          }
        }
      }
      const narrativeSeconds = mention.minutes * 60;
      const mismatches = [...new Set(configured.filter((seconds) => seconds > 0 && seconds !== narrativeSeconds))];
      if (!mismatches.length) continue;
      push({
        level: 'warning',
        code: 'timing_conflict',
        message: `Phase 叙述写 ${mention.minutes} 分钟无操作提醒（${narrativeSeconds}s），任务结构化字段包含 ${mismatches.join('/')}s。修复：统一 prompts/phases 叙述与任务「无操作提醒」。`,
        file: source.file,
        line: findLine(source.markdown, mention.snippet),
        phaseId,
      });
    }
  }

  return { issues };
}

export default auditCourseQuality;
