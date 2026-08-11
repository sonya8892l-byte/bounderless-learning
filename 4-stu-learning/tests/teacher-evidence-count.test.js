import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileCourse } from '../server/course/compiler.js';
import { createCourseRunService } from '../server/runtime/course-run-service.js';
import { createCourseRunStore } from '../server/runtime/course-run-store.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lessonsRoot = path.resolve(projectRoot, '../6-lessons');

// 教师端详情抽屉的「已提交 N 项证据」是老师点「人工通过」前唯一能看到的数字。
// 它此前是 `index % 4` 的演示种子，永不更新——老师照着一个假数字盲签。
// 这一组锁的是：数字只能来自学生端 presence 上报的真实条数。

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'teacher-evidence-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const service = createCourseRunService({
    store: createCourseRunStore({ baseDir: directory }),
    getCourse: (courseId) => compileCourse({ lessonsRoot, courseId }),
    realtime: { publish() {}, subscribe() { return () => undefined; } },
  });
  const run = await service.ensureDemoRun();
  return { service, run };
}

test('新建场次的证据条数一律从 0 起，不再有演示种子', async (t) => {
  const { service, run } = await fixture(t);

  const snapshot = await service.getSnapshot(run.id);
  const counts = snapshot.participants.map((item) => item.learning.evidenceCount);

  assert.ok(counts.length > 4, '前置条件：演示场次有足够多的学生，才能看出 index % 4 的周期');
  assert.deepEqual(
    [...new Set(counts)],
    [0],
    '任何非 0 的初值都是编造的：老师会据此判断该不该点「人工通过」',
  );
});

test('presence 上报的证据条数写进场次记录，教师 snapshot 读到真实值', async (t) => {
  const { service, run } = await fixture(t);
  const target = (await service.getSnapshot(run.id)).participants[3];
  await service.bindLearnerSession({ runId: run.id, participantId: target.id, sessionId: 'ses_evidence' });

  // 学生提交第一项证据后，学生端把 session.learningState.evidenceIds.length 带在 presence 里。
  await service.reportPresence('ses_evidence', { online: true, evidenceCount: 1 });

  const after = (await service.getSnapshot(run.id)).participants.find((item) => item.id === target.id);
  assert.equal(after.learning.evidenceCount, 1);
});

test('证据条数按上报值覆盖，且不接受负数', async (t) => {
  const { service, run } = await fixture(t);
  const target = (await service.getSnapshot(run.id)).participants[0];
  await service.bindLearnerSession({ runId: run.id, participantId: target.id, sessionId: 'ses_evidence_2' });
  const read = async () => (await service.getSnapshot(run.id))
    .participants.find((item) => item.id === target.id).learning.evidenceCount;

  await service.reportPresence('ses_evidence_2', { evidenceCount: 3 });
  assert.equal(await read(), 3);

  // 服务端不推断增量：学生端报的是累计条数，重连后重报同一个值不该翻倍。
  await service.reportPresence('ses_evidence_2', { evidenceCount: 3 });
  assert.equal(await read(), 3);

  await service.reportPresence('ses_evidence_2', { evidenceCount: -2 });
  assert.equal(await read(), 0);
});

test('不带 evidenceCount 的心跳不清零已有条数', async (t) => {
  const { service, run } = await fixture(t);
  const target = (await service.getSnapshot(run.id)).participants[1];
  await service.bindLearnerSession({ runId: run.id, participantId: target.id, sessionId: 'ses_evidence_3' });

  await service.reportPresence('ses_evidence_3', { evidenceCount: 2 });
  // 弱网下的纯心跳（只报 online/network）很常见，不能让它把证据数抹掉。
  await service.reportPresence('ses_evidence_3', { online: true, network: 'weak' });

  const after = (await service.getSnapshot(run.id)).participants.find((item) => item.id === target.id);
  assert.equal(after.learning.evidenceCount, 2);
});
