const MAX_RESTORED_MESSAGES = 200;

function safeText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n?/g, '\n').trim().slice(0, maxLength);
}

export function restoredDialogueMessages(dialogueHistory = []) {
  if (!Array.isArray(dialogueHistory)) return [];
  return dialogueHistory.slice(-MAX_RESTORED_MESSAGES).flatMap((item, index) => {
    const role = item?.role === 'user' || item?.role === 'assistant' ? item.role : '';
    const text = safeText(item?.text, 8_000);
    if (!role || !text) return [];
    const id = safeText(item?.id, 160) || `restored-dialogue-${index}`;
    return [{
      id,
      type: role,
      text,
      source: role === 'assistant' ? safeText(item?.source, 300) : '',
      createdAt: safeText(item?.createdAt, 64) || null,
    }];
  });
}

export function restoredTrackRuntime(session = {}, ownerTaskCount = 0) {
  const completedTaskIds = Array.isArray(session.completedTaskIds) ? session.completedTaskIds : [];
  const taskCount = Math.max(0, Number(ownerTaskCount) || 0);
  const activeTool = session.activeTool;
  const hasActiveTool = Boolean(activeTool?.callId && activeTool?.payload?.taskId);
  return {
    completed: taskCount > 0 && completedTaskIds.length >= taskCount,
    pendingAdvance: session.pendingAdvance?.taskId
      && ['teacher', 'student'].includes(session.pendingAdvance?.mode)
      ? { mode: session.pendingAdvance.mode, taskId: session.pendingAdvance.taskId }
      : null,
    activeTool: hasActiveTool ? {
      callId: activeTool.callId,
      taskId: activeTool.payload.taskId,
      payload: activeTool.payload,
    } : null,
  };
}
