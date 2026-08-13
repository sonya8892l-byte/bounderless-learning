import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createSessionRecord, normalizeSessionRecord } from './session-factory.js';

export function createSessionStore({ baseDir }) {
  async function ensure() {
    await fs.mkdir(baseDir, { recursive: true });
  }

  function filePath(id) {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('无效会话 ID。');
    return path.join(baseDir, `${id}.json`);
  }

  async function save(session) {
    await ensure();
    session.updatedAt = new Date().toISOString();
    const target = filePath(session.id);
    const temporary = `${target}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(session, null, 2), { mode: 0o600 });
    await fs.rename(temporary, target);
    return session;
  }

  async function create(values) {
    return save(createSessionRecord(values));
  }

  async function get(id) {
    try {
      return normalizeSessionRecord(JSON.parse(await fs.readFile(filePath(id), 'utf8')));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async function remove(id) {
    try {
      await fs.unlink(filePath(id));
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }

  return { create, get, save, remove };
}
