import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parsePlatformDefaultDocument } from '../../src/engine/platform-defaults.js';

// 平台缺省层文件清单。与三份底线规则不同，缺省层文件缺失不报错：运行时回落到 JS 里的
// 现有常量，行为与建立缺省层之前完全一致（双轨期）。
export const PLATFORM_DEFAULT_DEFINITIONS = Object.freeze([
  Object.freeze({ id: 'defaults', filename: 'defaults.md', title: '数值缺省' }),
]);

function versionFor(documents) {
  const hash = createHash('sha256');
  for (const definition of PLATFORM_DEFAULT_DEFINITIONS) {
    hash.update(definition.filename);
    hash.update('\0');
    hash.update(documents[definition.id]?.markdown ?? '\u0000missing');
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

export async function loadPlatformDefaults({ lessonsRoot, logger = console } = {}) {
  const directory = path.resolve(lessonsRoot, '_platform');
  const documents = {};
  const missing = [];

  for (const definition of PLATFORM_DEFAULT_DEFINITIONS) {
    let markdown;
    try {
      markdown = await fs.readFile(path.resolve(directory, definition.filename), 'utf8');
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      documents[definition.id] = null;
      missing.push(definition.filename);
      logger?.debug?.(`平台缺省层未提供 _platform/${definition.filename}，回落到代码内缺省值。`);
      continue;
    }
    documents[definition.id] = parsePlatformDefaultDocument(markdown, definition.filename);
  }

  return Object.freeze({
    version: versionFor(documents),
    documents: Object.freeze(documents),
    missing: Object.freeze(missing),
  });
}
