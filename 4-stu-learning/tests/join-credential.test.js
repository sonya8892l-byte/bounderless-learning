import assert from 'node:assert/strict';
import test from 'node:test';
import { consumeJoinCredential } from '../src/engine/join-credential.js';

test('入课凭证只在当前标签页保存，并立即从地址参数移除', () => {
  const params = new URLSearchParams({
    lesson: 'lesson_gewu_001',
    runId: 'run-1',
    participantId: 'student-1',
    joinCredential: 'private-join-credential',
  });
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  let sanitized = null;

  const credential = consumeJoinCredential(params, {
    courseId: 'lesson_gewu_001',
    storage,
    replaceSearch: (next) => { sanitized = next.toString(); },
  });

  assert.equal(credential, 'private-join-credential');
  assert.equal(params.has('joinCredential'), false);
  assert.doesNotMatch(sanitized, /joinCredential|private-join-credential/);

  const refreshed = new URLSearchParams({
    lesson: 'lesson_gewu_001',
    runId: 'run-1',
    participantId: 'student-1',
  });
  assert.equal(consumeJoinCredential(refreshed, {
    courseId: 'lesson_gewu_001',
    storage,
  }), 'private-join-credential');
});

test('不同场次或学生不能读取其他人的标签页凭证', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  consumeJoinCredential(new URLSearchParams({
    runId: 'run-1', participantId: 'student-1', joinCredential: 'credential-a',
  }), { courseId: 'lesson_gewu_001', storage });

  assert.equal(consumeJoinCredential(new URLSearchParams({
    runId: 'run-1', participantId: 'student-2',
  }), { courseId: 'lesson_gewu_001', storage }), '');
  assert.equal(consumeJoinCredential(new URLSearchParams({
    runId: 'run-2', participantId: 'student-1',
  }), { courseId: 'lesson_gewu_001', storage }), '');
});

test('新入课链接从 fragment 消费凭证，优先于旧 query 并同时清理', () => {
  const params = new URLSearchParams({
    lesson: 'lesson_gewu_001',
    runId: 'run-1',
    participantId: 'student-1',
    joinCredential: 'legacy-query-credential',
  });
  const fragmentParams = new URLSearchParams({
    joinCredential: 'private-fragment-credential',
  });
  const values = new Map();
  let sanitized = null;
  const credential = consumeJoinCredential(params, {
    courseId: 'lesson_gewu_001',
    storage: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    },
    fragmentParams,
    replaceLocation: (value) => { sanitized = value; },
  });
  assert.equal(credential, 'private-fragment-credential');
  assert.equal(sanitized.searchParams.has('joinCredential'), false);
  assert.equal(sanitized.fragmentParams.has('joinCredential'), false);
  assert.equal(JSON.stringify({
    search: sanitized.searchParams.toString(),
    hash: sanitized.fragmentParams.toString(),
  }).includes('credential'), false);
});
