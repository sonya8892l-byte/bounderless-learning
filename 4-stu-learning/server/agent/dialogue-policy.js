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

export function applyGradeResponsePolicy(text, grade, languageLevels = null) {
  const value = String(text || '').trim();
  const limit = languageLevelFor(languageLevels, grade).limit;
  if (value.length <= limit) return value;
  const slice = value.slice(0, limit);
  const boundary = Math.max(slice.lastIndexOf('。'), slice.lastIndexOf('！'), slice.lastIndexOf('？'));
  return `${(boundary >= Math.floor(limit * 0.55) ? slice.slice(0, boundary + 1) : slice).trim()}…`;
}

export function avoidRepeatedReply(session, text, { intent = '', dialogueMove = '', voice = null } = {}) {
  if (!isRepeatedAssistantText(session, text)) return text;
  const move = `${intent} ${dialogueMove}`;
  if (/conversation_repair/.test(move)) {
    return renderVoice(voice, 'avoid_repeat.conversation_repair');
  }
  if (/emotion|safety_help/.test(move)) {
    return renderVoice(voice, 'avoid_repeat.emotion');
  }
  if (/greeting|gratitude|goodbye|social|course_knowledge/.test(move)) {
    return renderVoice(voice, 'avoid_repeat.social');
  }
  return session.dialogueState?.pendingQuestion
    ? renderVoice(voice, 'avoid_repeat.有待答')
    : renderVoice(voice, 'avoid_repeat.默认');
}
