import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const EMPTY_STATE = {
  schemaVersion: 1,
  sequence: 0,
  runs: [],
  alerts: [],
  commands: [],
  receipts: [],
  interventions: [],
  auditEvents: [],
  events: [],
};

function clone(value) {
  return structuredClone(value);
}

export function createCourseRunStore({ baseDir }) {
  const target = path.join(baseDir, 'course-runs.json');
  let writeQueue = Promise.resolve();

  async function load() {
    try {
      return { ...clone(EMPTY_STATE), ...JSON.parse(await fs.readFile(target, 'utf8')) };
    } catch (error) {
      if (error.code === 'ENOENT') return clone(EMPTY_STATE);
      throw error;
    }
  }

  async function persist(state) {
    await fs.mkdir(baseDir, { recursive: true });
    const temporary = `${target}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
    await fs.rename(temporary, target);
  }

  async function read() {
    await writeQueue;
    return load();
  }

  function transaction(mutator) {
    const operation = writeQueue.then(async () => {
      const state = await load();
      const result = await mutator(state, { kind: 'file' });
      await persist(state);
      return result;
    });
    writeQueue = operation.catch(() => undefined);
    return operation;
  }

  return { read, transaction, kind: 'file' };
}
