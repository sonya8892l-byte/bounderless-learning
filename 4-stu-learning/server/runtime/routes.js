import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';

const actor = (request) => request.teacherActorId || request.headers['x-teacher-id'] || 'teacher-demo';

function bearerToken(request) {
  const authorization = String(request.headers.authorization || '');
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

function secureEqual(expected = '', actual = '') {
  const left = Buffer.from(String(expected));
  const right = Buffer.from(String(actual));
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

const targetSchema = z.object({
  scope: z.enum(['all', 'group', 'role', 'participant']),
  id: z.string().optional(),
});

const commandSchema = z.object({
  idempotencyKey: z.string().min(8).max(120),
  expectedVersion: z.coerce.number().int().positive(),
  action: z.enum([
    'send_notice', 'push_knowledge', 'add_time', 'remove_time', 'pause', 'resume',
    'release_roles', 'lock_roles', 'start_phase', 'advance_phase', 'end_run',
    'confirm_arrival', 'reject_evidence', 'approve_evidence', 'skip_step',
    'set_scaffold', 'switch_alternative', 'emergency_rally',
    // 解开 `推进方式：teacher` 的任务。真会推进学生进度，因此在教师端标高影响。
    'advance_task',
  ]),
  target: targetSchema,
  payload: z.record(z.unknown()).default({}),
  reason: z.string().min(2).max(500),
});

export async function registerRuntimeRoutes(app, {
  runtime,
  enableWebsocket = true,
  enableDemo = true,
  teacherAccess = {},
  resolveLearnerProjection = async () => null,
}) {
  app.addHook('onRequest', async (request, reply) => {
    const requestPath = String(request.url || '').split('?', 1)[0];
    if (!requestPath.startsWith('/api/teacher')) return;
    // Demo bootstrap is intentionally absent in production.  Let Fastify
    // return the truthful 404 instead of letting a prefix-wide auth hook turn
    // an unregistered endpoint into a misleading configuration error.
    if (!enableDemo && requestPath === '/api/teacher/demo') return;
    if (teacherAccess.required !== true) return;
    if (!String(teacherAccess.token || '')) {
      return reply.code(503).send({ error: '教师端认证尚未配置。' });
    }
    if (!secureEqual(teacherAccess.token, bearerToken(request))) {
      reply.header('www-authenticate', 'Bearer');
      return reply.code(401).send({ error: '教师端认证失败。' });
    }
    request.teacherActorId = String(teacherAccess.teacherId || 'teacher-primary');
  });
  const authorize = (request) => runtime.assertTeacherAccess(request.params.runId, actor(request));
  if (enableDemo) {
    app.post('/api/teacher/demo', async () => runtime.ensureDemoRun());
  }

  app.get('/api/teacher/runs', async (request) => runtime.listRuns(actor(request)));

  app.post('/api/teacher/runs', async (request, reply) => {
    const body = z.object({
      courseId: z.string().default('lesson_gewu_001'),
      className: z.string().min(1).max(100),
      courseVersion: z.string().default('1.0.0'),
      groupCount: z.coerce.number().int().min(1).max(10).default(5),
      reason: z.string().default('创建新的教学场次'),
    }).parse(request.body);
    reply.code(201);
    return runtime.createRun({ ...body, teacherId: actor(request) });
  });

  app.get('/api/teacher/runs/:runId/snapshot', async (request) => { await authorize(request); return runtime.getSnapshot(request.params.runId); });
  app.get('/api/teacher/runs/:runId/preflight', async (request) => { await authorize(request); return runtime.preflight(request.params.runId); });
  app.get('/api/teacher/runs/:runId/events', async (request) => { await authorize(request); return runtime.getEvents(request.params.runId, request.query.after); });
  app.get('/api/teacher/runs/:runId/review', async (request) => { await authorize(request); return runtime.getReview(request.params.runId); });

  app.post('/api/teacher/runs/:runId/audit', async (request, reply) => {
    await authorize(request);
    const body = z.object({
      action: z.enum(['transcript.view_requested', 'review.exported', 'privacy.override']),
      subject: z.record(z.unknown()).optional(), reason: z.string().min(2).max(500),
      payload: z.record(z.unknown()).optional(),
    }).parse(request.body);
    reply.code(201);
    return runtime.recordAudit(request.params.runId, { ...body, actorId: actor(request) });
  });

  app.post('/api/teacher/runs/:runId/roster/import', async (request) => {
    await authorize(request);
    const body = z.object({ csv: z.string().min(1), reason: z.string().default('导入学生名单') }).parse(request.body);
    return runtime.importRoster(request.params.runId, { ...body, actorId: actor(request) });
  });

  app.patch('/api/teacher/runs/:runId/participants/:participantId', async (request) => {
    await authorize(request);
    const body = z.object({
      name: z.string().min(1).max(100).optional(), groupId: z.string().optional(), roleId: z.string().optional(),
      recheckDevice: z.boolean().optional(), reason: z.string().min(2).max(500),
    }).parse(request.body);
    return runtime.updateParticipant(request.params.runId, request.params.participantId, { ...body, actorId: actor(request) });
  });

  app.patch('/api/teacher/runs/:runId/alerts/:alertId', async (request) => {
    await authorize(request);
    const body = z.object({
      status: z.enum(['acknowledged', 'in_progress', 'resolved', 'false_alarm']),
      reason: z.string().min(2).max(500),
      resolution: z.string().max(1000).optional(),
    }).parse(request.body);
    return runtime.updateAlert(request.params.runId, request.params.alertId, { ...body, actorId: actor(request) });
  });

  app.post('/api/teacher/runs/:runId/commands', async (request, reply) => {
    await authorize(request);
    const body = commandSchema.parse(request.body);
    const result = await runtime.sendCommand(request.params.runId, { ...body, actorId: actor(request) });
    reply.code(202);
    return result;
  });

  if (enableWebsocket) {
    app.get('/api/teacher/runs/:runId/live', { websocket: true, preValidation: authorize }, (socket, request) => {
      const runId = request.params.runId;
      const unsubscribe = runtime.realtime.subscribe(runId, socket);
      socket.send(JSON.stringify({ type: 'realtime.ready', runId, createdAt: new Date().toISOString() }));
      socket.on('close', unsubscribe);
      socket.on('error', unsubscribe);
    });
  }

  app.post('/api/student/help', async (request, reply) => {
    const body = z.object({
      sessionId: z.string().min(1),
      participantId: z.string().optional(),
      kind: z.enum(['task', 'safety']).default('task'),
      reason: z.string().max(1000).optional(),
    }).parse(request.body);
    reply.code(202);
    return runtime.requestHelp(body);
  });

  app.post('/api/student/sessions/:sessionId/presence', async (request) => {
    const body = z.object({
      online: z.boolean().optional(), network: z.enum(['ready', 'weak', 'offline']).optional(),
      camera: z.object({
        permission: z.enum(['unknown', 'prompt', 'granted', 'denied', 'unavailable']),
      }).strict().optional(),
      location: z.object({
        lng: z.coerce.number().min(-180).max(180).optional(),
        lat: z.coerce.number().min(-90).max(90).optional(),
        accuracyMeters: z.coerce.number().min(0).optional(),
        permission: z.enum(['unknown', 'prompt', 'granted', 'denied', 'unavailable']).optional(),
      }).strict().optional(),
    }).strict().parse(request.body);
    const trustedLearningProjection = await resolveLearnerProjection(request.params.sessionId);
    return runtime.reportPresence(request.params.sessionId, body, { trustedLearningProjection });
  });

  app.get('/api/student/sessions/:sessionId/commands', async (request) => (
    runtime.commandsForSession(request.params.sessionId, request.query.after)
  ));

  app.post('/api/student/sessions/:sessionId/commands/:commandId/receipt', async (request) => {
    const body = z.object({ status: z.enum(['delivered', 'confirmed', 'failed']) }).parse(request.body);
    return runtime.confirmCommand(request.params.sessionId, request.params.commandId, body.status);
  });
}
