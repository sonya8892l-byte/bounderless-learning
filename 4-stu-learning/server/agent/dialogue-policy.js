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

export function taskRequiresArrival(task) {
  return Boolean(task?.location?.mode && task.location.mode !== 'none');
}

export function arrivalQuestion(task, role) {
  const place = task.location?.name || role.location || '当前任务点';
  return {
    id: `arrival:${task.id}`,
    type: 'arrival_confirmation',
    kind: 'arrival',
    slot: 'arrival',
    prompt: `你已经到“${place}”了吗？`,
    quickReplies: [
      { id: 'arrival-yes', label: '已到达', value: '我已到达', act: 'affirm' },
      { id: 'arrival-no', label: '还在路上', value: '我还没到', act: 'deny' },
      { id: 'arrival-nav', label: '需要导航', value: '请帮我导航', act: 'request_navigation' },
    ],
    expectedActs: ['affirm', 'deny', 'request_navigation'],
  };
}

export function readinessQuestion(task) {
  return {
    id: `readiness:${task.id}`,
    type: 'readiness_confirmation',
    kind: 'readiness',
    slot: 'readiness',
    prompt: '你准备好开始了吗？',
    quickReplies: [
      { id: 'readiness-yes', label: '现在开始', value: '我准备好了', act: 'affirm' },
      { id: 'readiness-no', label: '等一下', value: '我还没准备好', act: 'deny' },
    ],
    expectedActs: ['affirm', 'deny'],
  };
}

export function nextOnboardingQuestion({ session, task, role }) {
  const slots = session.dialogueState?.confirmedSlots || {};
  if (taskRequiresArrival(task) && slots.arrival !== true) return arrivalQuestion(task, role);
  if (slots.readiness !== true) return readinessQuestion(task);
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

export function conversationRepair(session) {
  suspendPendingQuestion(session);
  recordConversationRepair(session);
  return {
    text: '你说得对，刚才的回应让人很烦。我先停下来听你说；想继续时告诉我“继续”就行。',
    dialogueMove: 'repair_conversation',
    quickReplies: [],
  };
}

export function unclearInputReply(session) {
  const count = recordMisunderstanding(session);
  const pending = session.dialogueState?.pendingQuestion;
  return {
    text: count > 1
      ? '这条我还是没理解。直接点一个选项就可以。'
      : '我没太看懂这条消息。你可以换句话说，也可以直接点选项。',
    dialogueMove: 'clarify_input',
    quickReplies: pending?.quickReplies || [],
  };
}

export function applyGradeResponsePolicy(text, grade, languageLevels = null) {
  const value = String(text || '').trim();
  const limit = languageLevelFor(languageLevels, grade).limit;
  if (value.length <= limit) return value;
  const slice = value.slice(0, limit);
  const boundary = Math.max(slice.lastIndexOf('。'), slice.lastIndexOf('！'), slice.lastIndexOf('？'));
  return `${(boundary >= Math.floor(limit * 0.55) ? slice.slice(0, boundary + 1) : slice).trim()}…`;
}

export function avoidRepeatedReply(session, text, { intent = '', dialogueMove = '' } = {}) {
  if (!isRepeatedAssistantText(session, text)) return text;
  const move = `${intent} ${dialogueMove}`;
  if (/conversation_repair/.test(move)) {
    return '我听见了，也先不催你。你想说什么就继续说，想回到学习时告诉我“继续”。';
  }
  if (/emotion|safety_help/.test(move)) {
    return '我还在，先照顾好自己。你可以慢慢说，现在不需要赶任务。';
  }
  if (/greeting|gratitude|goodbye|social|course_knowledge|onboarding_unclear/.test(move)) {
    return '嗯嗯，我还在听～你可以接着说，想回到学习时告诉我“继续”。';
  }
  return session.dialogueState?.pendingQuestion
    ? '这件事我已经问过了，你可以直接点下面的选项，我会按你的回答继续。'
    : '这句话我刚才说过了。我们接着你现在的想法往下聊。';
}
