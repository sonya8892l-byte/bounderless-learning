const OPENING_HEADING = /^\s*\*\*开场引导\s*[：:]?\s*\*\*\s*[：:]?\s*$/;
const BOLD_HEADING = /^\s*\*\*[^*\n]+\*\*\s*[：:]?\s*$/;
const MARKDOWN_HEADING = /^\s*#{1,6}\s+/;

function firstQuotedBullet(lines) {
  for (const line of lines) {
    const match = String(line).match(/^\s*[-*]\s+["“]([^"”\n]+)["”]\s*$/);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

/** 只读取显式“开场引导”小节的第一条直接话术；格式不明确时保持关闭。 */
export function taskOpeningGuidance(task) {
  const lines = String(task?.guidance || '').split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => OPENING_HEADING.test(line));
  if (headingIndex < 0) return '';

  const block = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (BOLD_HEADING.test(lines[index]) || MARKDOWN_HEADING.test(lines[index])) break;
    block.push(lines[index]);
  }
  return firstQuotedBullet(block);
}

function scaffoldL0(source) {
  const text = String(source || '');
  if (!text) return '';
  const table = text.match(/^\s*\|\s*L0\s*\|\s*["“]?([^|\n"”]+?)["”]?\s*\|?\s*$/im);
  const list = text.match(/^\s*[-*]?\s*L0\s*[：:]\s*["“]?([^\n"”]+?)["”]?\s*$/im);
  return String((table || list)?.[1] || '').trim();
}

/** 第一阶段仅为含显式任务开场的任务启用 Step（小步）进入方向，避免改变旧课程行为。 */
export function stepEntryDirection(task, step) {
  if (!taskOpeningGuidance(task)) return '';
  return taskOpeningGuidance(step) || scaffoldL0(step?.scaffold);
}
