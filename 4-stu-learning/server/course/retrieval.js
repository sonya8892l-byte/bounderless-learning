function roleAllows(entry, role) {
  return entry.roles.some((name) => name === role.name || name === '全角色共享' || name === '全部角色');
}

function completed(session, roleId, taskNumber, course) {
  const role = course?.roles?.find((item) => item.id === roleId);
  const taskId = role?.tasks?.[taskNumber - 1]?.id || `task-${taskNumber}`;
  return session.completedTaskIds.includes(`${roleId}:${taskId}`);
}

export function restrictionUnlocked(restriction, session, course) {
  const condition = restriction.unlockWhen;
  if (/模拟运行后/.test(condition)) return session.events.includes('xuanji-simulation:completed');
  const fallbackRoleMap = {
    数龙官: 'dragon-counter',
    测坡官: 'slope-surveyor',
    寻沟官: 'ditch-finder',
    引河官: 'river-guide',
    护城官: 'moat-guard',
    真相官: 'truth-seeker',
  };
  const roleMap = course?.roles?.length
    ? Object.fromEntries(course.roles.map((role) => [role.name, role.id]))
    : fallbackRoleMap;
  const roleName = Object.keys(roleMap).find((name) => condition.includes(name));
  const taskNumber = Number.parseInt(condition.match(/任务\s*(\d+)/)?.[1], 10);
  if (roleName && taskNumber) return completed(session, roleMap[roleName], taskNumber, course);
  const phase = Number.parseInt(condition.match(/Phase\s*(\d+)/i)?.[1], 10);
  if (phase && session.phaseNumber >= phase) return true;
  return false;
}

function knowledgeVisible(entry, session, role, course) {
  if (!roleAllows(entry, role)) return false;
  const rule = entry.revealWhen.toLowerCase();
  if (/always|content_always_available/.test(rule)) return true;
  const taskNumber = Number.parseInt(rule.match(/after[_-]?task(\d+)/)?.[1], 10);
  if (taskNumber) return completed(session, role.id, taskNumber, course);
  if (/truth[_-]?seeker.*task2/.test(rule)) {
    return session.roleId === 'truth-seeker' && completed(session, 'truth-seeker', 2, course);
  }
  const phaseNumber = Number.parseInt(rule.match(/phase[_:-]?(\d+)/)?.[1], 10);
  if (phaseNumber) return session.phaseNumber >= phaseNumber;
  const spacedPhaseNumber = Number.parseInt(rule.match(/phase\s+(\d+)/)?.[1], 10);
  if (spacedPhaseNumber) return session.phaseNumber >= spacedPhaseNumber;
  // 开题安全培训属于课程进入即生效的全局安全知识。课程作者仍应逐步改用结构化
  // phase_N；这条兼容现有课程中的自然语言揭示条件，避免安全知识永久不可见。
  if (/开题.*(?:安全)?培训时/.test(rule)) return session.phaseNumber >= 1;
  return false;
}

function redactLockedTerms(content, course, session) {
  let result = content;
  for (const restriction of course.restrictions) {
    if (restrictionUnlocked(restriction, session, course)) continue;
    for (const term of restriction.protectedTerms) result = result.replaceAll(term, '[待学生探索的数据]');
  }
  return result;
}

function tokens(text = '') {
  const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const values = new Set();
  for (let index = 0; index < normalized.length - 1; index += 1) values.add(normalized.slice(index, index + 2));
  return values;
}

function focusedQuery(query = '') {
  let value = String(query);
  if (/龙头/.test(value)) value += ' 螭首';
  if (/嘴|张开/.test(value)) value += ' 排水 螭首';
  if (/作用|用处/.test(value)) value += ' 功能';
  return value
    .toLowerCase()
    .replace(/六百年/g, '600年')
    .replace(/不能|不可以|不可/g, '不')
    .replace(/自己/g, '')
    .replace(/我想知道|请问|能不能|可不可以|怎么回事|为什么|怎么样|是什么|有什(?:么|麼)|有啥|如何|哪些|哪个|多少|是不是|真的/g, '')
    .replace(/[这个那个它他们她们呢吗呀啊吧么的了请告诉给讲说一下\s，。！？、；：,.!?;:'"“”‘’~～—_-]/g, '');
}

function relevance(entry, query) {
  // 标题与标签负责“它谈什么”，正文负责“它能不能回答这一问”。旧实现只看标题标签，
  // 因此任何含“排水”的问题都会落到列表第一张螭首卡。
  const haystack = `${entry.topic}${entry.title}${entry.tags.join('')}${entry.content}`.toLowerCase();
  const focus = focusedQuery(query) || String(query || '').toLowerCase();
  const expandedQuery = `${String(query || '').toLowerCase()}${focus}`;
  let score = 0;
  let specificMatch = false;
  let exactTagMatches = 0;
  for (const tag of entry.tags) {
    if (!expandedQuery.includes(String(tag).toLowerCase())) continue;
    exactTagMatches += 1;
    score += 10 + Math.min(String(tag).length, 6);
    if (String(tag).length >= 3) specificMatch = true;
  }
  if (query.includes(entry.topic) || entry.topic.includes(focus)) {
    score += 16;
    specificMatch = true;
  }
  if (/为什么|怎么|如何|有什(?:么|麼)用|作用|原理|机制/.test(query)
    && /功能|原理|机制|作用/.test(`${entry.topic}${entry.title}`)) {
    score += 8;
  }
  const queryTokens = tokens(focus);
  const entryTokens = tokens(haystack);
  let overlap = 0;
  for (const token of queryTokens) {
    if (!entryTokens.has(token)) continue;
    overlap += 1;
    score += 1;
  }
  const coverage = queryTokens.size ? overlap / queryTokens.size : 0;
  const focusCompact = focus.replace(/[^\p{L}\p{N}]+/gu, '');
  let sharedTrigram = false;
  for (let index = 0; index <= focusCompact.length - 3; index += 1) {
    if (haystack.includes(focusCompact.slice(index, index + 3))) {
      sharedTrigram = true;
      break;
    }
  }
  return {
    score,
    relevant: specificMatch
      || sharedTrigram
      || coverage >= 0.34
      || (exactTagMatches > 0 && overlap >= 2)
      || (exactTagMatches > 0 && /^(?:那|它|这个|这些)/.test(String(query).trim()))
      || (queryTokens.size <= 2 && overlap > 0),
  };
}

function compactContent(content, query, maxLength = 700) {
  const paragraphs = String(content || '')
    .split(/\n{2,}/)
    .map((text, index) => ({ text: text.trim(), index }))
    .filter((item) => item.text);
  if (!paragraphs.length) return '';
  const queryTokens = tokens(query);
  const ranked = paragraphs.map((item) => {
    const paragraphTokens = tokens(item.text);
    let score = /^#{1,4}\s/.test(item.text) ? 1 : 0;
    for (const token of queryTokens) if (paragraphTokens.has(token)) score += 1;
    return { ...item, score };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = [];
  let length = 0;
  for (const item of ranked) {
    if (selected.length && length + item.text.length > maxLength) continue;
    selected.push(item);
    length += item.text.length;
    if (length >= maxLength * 0.75) break;
  }
  return selected.sort((a, b) => a.index - b.index).map((item) => item.text).join('\n\n').slice(0, maxLength);
}

export function retrieveKnowledge({ course, session, role, query, references = '', limit = 2 }) {
  const referencedIds = new Set(
    [...String(references).matchAll(/\bK-?(\d+)\b/gi)]
      .map((match) => `K-${String(Number(match[1])).padStart(2, '0')}`),
  );
  return course.knowledge
    .filter((entry) => knowledgeVisible(entry, session, role, course))
    .map((entry) => {
      const match = relevance(entry, query);
      const referenced = referencedIds.has(entry.id);
      return {
        ...entry,
        score: match.score + (referenced ? 100 : 0),
        relevant: referenced || match.relevant,
      };
    })
    .filter((entry) => entry.relevant && entry.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((entry) => ({
      ...entry,
      content: compactContent(redactLockedTerms(entry.content, course, session), focusedQuery(query) || query),
    }));
}

export function findSpoiler(text, course, session) {
  for (const restriction of course.restrictions) {
    if (restrictionUnlocked(restriction, session, course)) continue;
    const term = restriction.protectedTerms.find((value) => text.includes(value));
    if (term) return { restriction, term };
  }
  return null;
}
