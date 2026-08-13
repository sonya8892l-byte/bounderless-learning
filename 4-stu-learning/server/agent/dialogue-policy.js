import {
  clearPendingQuestion,
  confirmDialogueSlot,
  isRepeatedAssistantText,
  recordConversationRepair,
  recordMisunderstanding,
  setPendingQuestion,
  suspendPendingQuestion,
} from './session-state.js';
import { languageLevelFor } from '../course/platform-defaults.js';
import { renderVoice } from '../course/voice.js';

export function taskRequiresArrival(task) {
  return Boolean(task?.location?.mode && task.location.mode !== 'none');
}

export function arrivalQuestion(task, role, voice = null) {
  const place = task.location?.name || role.location || '当前任务点';
  const say = (key, params) => renderVoice(voice, key, params);
  return {
    id: `arrival:${task.id}`,
    type: 'arrival_confirmation',
    kind: 'arrival',
    slot: 'arrival',
    prompt: say('onboarding.到达确认', { place }),
    quickReplies: [
      { id: 'arrival-yes', label: say('onboarding.到达.已到达'), value: say('onboarding.到达.value.已到达'), act: 'affirm' },
      { id: 'arrival-no', label: say('onboarding.到达.还在路上'), value: say('onboarding.到达.value.还在路上'), act: 'deny' },
      { id: 'arrival-nav', label: say('onboarding.到达.需要导航'), value: say('onboarding.到达.value.需要导航'), act: 'request_navigation' },
    ],
    expectedActs: ['affirm', 'deny', 'request_navigation'],
  };
}

export function readinessQuestion(task, voice = null) {
  const say = (key) => renderVoice(voice, key);
  return {
    id: `readiness:${task.id}`,
    type: 'readiness_confirmation',
    kind: 'readiness',
    slot: 'readiness',
    prompt: say('onboarding.准备确认'),
    quickReplies: [
      { id: 'readiness-yes', label: say('onboarding.准备.现在开始'), value: say('onboarding.准备.value.现在开始'), act: 'affirm' },
      { id: 'readiness-no', label: say('onboarding.准备.等一下'), value: say('onboarding.准备.value.等一下'), act: 'deny' },
    ],
    expectedActs: ['affirm', 'deny'],
  };
}

export function nextOnboardingQuestion({ session, task, role, voice = null }) {
  const slots = session.dialogueState?.confirmedSlots || {};
  if (taskRequiresArrival(task) && slots.arrival !== true) return arrivalQuestion(task, role, voice);
  if (slots.readiness !== true) return readinessQuestion(task, voice);
  return null;
}

export function askQuestion(session, question) {
  setPendingQuestion(session, question);
  return {
    text: question.prompt,
    quickReplies: question.quickReplies,
    dialogueMove: question.kind === 'arrival' ? 'ask_arrival' : 'ask_readiness',
  };
}

export function applyPendingAnswer(session, resolution) {
  const pending = session.dialogueState?.pendingQuestion;
  if (!pending || !resolution?.matched) return null;
  confirmDialogueSlot(session, pending.slot, resolution.value);
  clearPendingQuestion(session, { outcome: resolution.value ? 'confirmed' : 'denied' });
  return { pending, value: resolution.value };
}

export function conversationRepair(session, voice = null) {
  suspendPendingQuestion(session);
  recordConversationRepair(session);
  return {
    text: renderVoice(voice, 'conversation_repair.主回复'),
    dialogueMove: 'repair_conversation',
    quickReplies: [],
  };
}

export function unclearInputReply(session, voice = null) {
  const count = recordMisunderstanding(session);
  const pending = session.dialogueState?.pendingQuestion;
  return {
    text: count > 1
      ? renderVoice(voice, 'unclear_input.再次')
      : renderVoice(voice, 'unclear_input.首次'),
    dialogueMove: 'clarify_input',
    quickReplies: pending?.quickReplies || [],
  };
}

/**
 * 安全回合保持确定性和即时性，同时根据明确风险给出一条对应行动。
 * 这里不做诊断，不给处置细节；所有分支都会停止当前活动并呼叫成人。
 */
export function safetyHelpReply(text = '', voice = null) {
  const value = String(text || '');
  if (/着火|起火|烟味|有烟/.test(value)) {
    return '请立即远离烟火，跟随现场工作人员疏散。我已经呼叫老师。';
  }
  if (/呼吸困难|喘不上气|胸闷|晕倒/.test(value)) {
    return '立即停止活动，留在安全位置，马上告诉身边的成年人。我已经呼叫老师。';
  }
  if (/陌生人/.test(value)) {
    return '不要跟陌生人离开，去有工作人员或同伴的显眼位置。我已经呼叫老师。';
  }
  if (/走失|走散|落单|迷路|找不到.{0,6}(?:队伍|同学|小组|老师)/.test(value)) {
    return '留在安全、显眼的位置，不要独自继续找路。我已经呼叫老师。';
  }
  if (/掉进水|滑下去|水边/.test(value)) {
    return '马上远离水边，不要自行下水或拉人。我已经呼叫老师。';
  }
  if (/(?:翻|跨|爬).{0,5}护栏|护栏.{0,5}(?:翻|跨|爬)/.test(value)) {
    return '请立即停下，退回护栏内的安全位置。我已经呼叫老师。';
  }
  if (/受伤|流血|摔倒|被推|脚.{0,3}(?:扭|崴)|头晕|恶心|肢子疼|不舒服/.test(value)) {
    return '先停下，在安全位置休息，不要继续走动。我已经呼叫老师。';
  }
  return renderVoice(voice, 'safety_help.呼叫老师');
}

export function applyGradeResponsePolicy(text, grade, languageLevels = null) {
  // 学段“硬上限”现在约束单个气泡；全文会由 splitGradeResponse 分泡保留。
  // 这里继续作为统一的清理入口，禁止再用字符切片丢掉后半句。
  languageLevelFor(languageLevels, grade);
  return String(text || '').trim();
}

function preferredBubbleBreak(value, limit) {
  const window = value.slice(0, limit);
  const strong = ['\n', '。', '！', '？', '!', '?', '；', ';'];
  const soft = ['，', ',', '：', ':', ' '];
  for (const boundaries of [strong, soft]) {
    const index = Math.max(...boundaries.map((mark) => window.lastIndexOf(mark)));
    if (index >= Math.floor(limit * 0.45)) return index + 1;
  }
  return limit;
}

export function splitGradeResponse(text, grade, languageLevels = null) {
  const limit = Math.max(1, Number(languageLevelFor(languageLevels, grade).limit || 1));
  let remaining = applyGradeResponsePolicy(text, grade, languageLevels);
  const parts = [];
  while (remaining.length > limit) {
    const end = preferredBubbleBreak(remaining, limit);
    const part = remaining.slice(0, end);
    if (part) parts.push(part);
    remaining = remaining.slice(end);
  }
  if (remaining) parts.push(remaining);
  return parts;
}

export function avoidRepeatedReply(session, text, { intent = '', dialogueMove = '', voice = null } = {}) {
  if (!isRepeatedAssistantText(session, text)) return text;
  const move = `${intent} ${dialogueMove}`;
  if (/conversation_repair/.test(move)) {
    return renderVoice(voice, 'avoid_repeat.conversation_repair');
  }
  if (/safety_help/.test(move)) {
    return renderVoice(voice, 'avoid_repeat.safety');
  }
  if (/emotion/.test(move)) {
    return renderVoice(voice, 'avoid_repeat.emotion');
  }
  if (/greeting|gratitude|goodbye|social|course_knowledge/.test(move)) {
    return renderVoice(voice, 'avoid_repeat.social');
  }
  // 教学回复重复通常意味着学生仍在处理同一步或再次提交了
  // 相同证据。保留有用内容，不用“这句话我说过了”指责学生；
  // 真正需要换档的求助由 tutorPolicy 的脚手架升档处理。
  return session.dialogueState?.pendingQuestion
    ? renderVoice(voice, 'avoid_repeat.有待答')
    : text;
}
