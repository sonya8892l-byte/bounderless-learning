function cleanTitle(value = '') {
  return String(value)
    .trim()
    .replace(/\s+#+\s*$/, '')
    .trim();
}

function tableCells(line = '') {
  const text = String(line).trim();
  if (!text.startsWith('|') || !text.endsWith('|')) return [];
  return text.split('|').slice(1, -1).map((cell) => cell.trim());
}

function isTableSeparator(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseNamedTableRows(section) {
  const lines = section.body.split('\n');
  const rows = [];
  let headers = [];

  for (let index = 0; index < lines.length; index += 1) {
    const cells = tableCells(lines[index]);
    if (!cells.length) {
      headers = [];
      continue;
    }

    const nextCells = tableCells(lines[index + 1]);
    if (nextCells.length === cells.length && isTableSeparator(nextCells)) {
      headers = cells;
      index += 1;
      continue;
    }
    if (!headers.length || cells.length !== headers.length || isTableSeparator(cells)) continue;

    const title = cleanTitle(cells[0]);
    if (!title) continue;
    const details = cells.slice(1)
      .map((cell, cellIndex) => `${headers[cellIndex + 1] || `字段${cellIndex + 2}`}：${cell}`)
      .join('\n');
    rows.push({
      title,
      kind: 'table-row',
      level: section.level,
      sectionTitle: section.title,
      text: `${headers[0] || '限制项'}：${title}${details ? `\n${details}` : ''}`,
    });
  }

  return rows;
}

/**
 * Parse only named level-2/level-3 restriction sections. A section ends at the
 * next heading of the same or a higher level, so resolving one reference never
 * pulls the remainder of the course restriction namespace into a model prompt.
 */
export function parseRestrictionDocument(markdown = '') {
  const source = String(markdown || '');
  const headings = [...source.matchAll(/^\s{0,3}(#{2,3})\s+(.+?)\s*$/gm)]
    .map((match) => ({
      index: match.index,
      bodyStart: match.index + match[0].length,
      level: match[1].length,
      title: cleanTitle(match[2]),
    }));

  const sections = headings.map((heading, index) => {
    const next = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level);
    return {
      title: heading.title,
      kind: 'section',
      level: heading.level,
      text: source.slice(heading.bodyStart, next?.index ?? source.length).trim(),
    };
  });

  const rows = sections.flatMap((section) => parseNamedTableRows({
    ...section,
    body: section.text,
  }));

  return { sections, rows };
}

export function restrictionReferenceTitles(references = '') {
  const values = Array.isArray(references) ? references : String(references || '').split(/[,\uff0c\n]/);
  const titles = [];
  for (const value of values) {
    const match = String(value).trim().match(/(?:^|\/)(?:restrictions\.md#|course\.md#课程限制规则\/)(.+)$/i);
    if (!match) continue;
    let title = match[1].trim();
    try { title = decodeURIComponent(title); } catch { /* Keep the course-authored value. */ }
    title = cleanTitle(title);
    if (title && !titles.includes(title)) titles.push(title);
  }
  return titles;
}

/**
 * Resolve the canonical `course.md#课程限制规则/title` reference, while keeping
 * the legacy `restrictions.md#title` form readable during migration, to the smallest named unit:
 * a matching table row first, otherwise the matching ##/### section.
 */
export function resolveRestrictionReferences(documentOrMarkdown, references = '') {
  const document = typeof documentOrMarkdown === 'string'
    ? parseRestrictionDocument(documentOrMarkdown)
    : (documentOrMarkdown || { sections: [], rows: [] });
  const rows = new Map((document.rows || []).map((item) => [item.title, item]));
  const sections = new Map((document.sections || []).map((item) => [item.title, item]));

  return restrictionReferenceTitles(references).flatMap((title) => {
    const item = rows.get(title) || sections.get(title);
    return item ? [{ reference: `course.md#课程限制规则/${title}`, ...item }] : [];
  });
}

/** Shared runtime entry point for dialogue prompts and AI-evaluation prompts. */
export function resolveStepRestrictions(course, step) {
  const document = course?.restrictionDocument
    || parseRestrictionDocument(course?.restrictionMarkdown || '');
  return resolveRestrictionReferences(document, step?.restrictionRef || '');
}
