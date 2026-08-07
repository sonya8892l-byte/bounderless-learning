import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import { z } from 'zod';
import { compileCourse } from './course/compiler.js';
import { createLLM } from './services/llm.js';
import { createSessionStore } from './services/store.js';
import { AgentActionError, createAgentService } from './agent/service.js';
import { createCourseRunStore } from './runtime/course-run-store.js';
import { createCourseRunService } from './runtime/course-run-service.js';
import { createRealtimeHub } from './runtime/realtime.js';
import { registerRuntimeRoutes } from './runtime/routes.js';
import { createPostgresCourseRunStore, createPostgresSessionStore } from './runtime/postgres-store.js';
import { createEvidenceStore } from './services/evidence-store.js';
import { createDatabasePool, probeDatabase } from './database/pool.js';
import { DatabaseConfigurationError } from './database/errors.js';
import { createLearnerRequestStore } from './database/learner-request-store.js';

const sessionSchema = z.object({
  courseId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  roleId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  studentId: z.string().min(1).max(100),
  groupId: z.string().min(1).max(100),
  runId: z.string().min(1).max(100).optional(),
  participantId: z.string().min(1).max(100).optional(),
  grade: z.string().max(40).optional(),
});

const turnSchema = z.object({
  sessionId: z.string().min(1),
  requestId: z.string().min(1).max(100),
  input: z.discriminatedUnion('type', [
    z.object({ type: z.literal('user_text'), text: z.string().min(1).max(2000) }),
    z.object({
      type: z.literal('quick_reply'),
      questionId: z.string().min(1).max(120),
      act: z.enum(['affirm', 'deny', 'request_navigation', 'request_help']),
      value: z.string().min(1).max(200),
    }),
    z.object({ type: z.literal('lifecycle_event'), event: z.string().min(1).max(100), data: z.record(z.unknown()).optional() }),
    z.object({
      type: z.literal('tool_result'),
      toolCallId: z.string().min(1),
      result: z.object({
        status: z.enum(['completed', 'cancelled', 'failed']),
        values: z.record(z.unknown()).optional(),
        evidence: z.array(z.object({ id: z.string(), url: z.string(), mimeType: z.string().optional() })).optional(),
      }),
    }),
  ]),
});

const EVIDENCE_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/heic', '.heic'],
  ['image/heif', '.heif'],
  ['audio/webm', '.webm'],
  ['audio/ogg', '.ogg'],
  ['audio/mp4', '.m4a'],
  ['audio/mpeg', '.mp3'],
  ['audio/wav', '.wav'],
  ['audio/x-wav', '.wav'],
]);

function publicSession(session) {
  return {
    id: session.id,
    courseId: session.courseId,
    roleId: session.roleId,
    studentId: session.studentId,
    groupId: session.groupId,
    runId: session.runId || null,
    participantId: session.participantId || null,
    phaseId: session.phaseId,
    currentTaskIndex: session.currentTaskIndex,
    completedTaskIds: session.completedTaskIds,
    scaffoldLevel: session.scaffoldLevel,
    timeBalance: session.timeBalance,
    timeEarned: session.timeEarned,
    completedBankTaskIds: session.completedBankTaskIds,
    runtime: session.taskState ? {
      task: session.taskState,
      location: session.locationState,
      conversation: session.conversationState,
      dialogue: session.dialogueState,
      learner: session.learnerState,
      environment: session.environmentState,
      learning: session.learningState,
    } : null,
    updatedAt: session.updatedAt,
  };
}

function openSse(reply) {
  reply.hijack();
  reply.raw.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  return {
    send(type, data) {
      if (reply.raw.writableEnded || reply.raw.destroyed) return false;
      return reply.raw.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    end() {
      if (!reply.raw.writableEnded && !reply.raw.destroyed) reply.raw.end();
    },
  };
}

function secureTokenMatches(expected, provided) {
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function readinessToken(request) {
  const authorization = request.headers.authorization || '';
  if (authorization.startsWith('Bearer ')) return authorization.slice(7);
  return request.headers['x-readiness-token'] || '';
}

function learnerRequestDigest(input) {
  return `sha256:${crypto.createHash('sha256')
    .update(JSON.stringify({ sessionId: input.sessionId, input: input.input }))
    .digest('hex')}`;
}

function turnDeadlineError() {
  return Object.assign(new Error('本次 AI 请求超过整体处理时限。'), {
    name: 'TurnDeadlineError',
    code: 'AI_TURN_TIMEOUT',
    statusCode: 504,
  });
}

function requiresPersistentInfrastructure(env) {
  return ['preview', 'production'].includes(env.APP_ENV);
}

function evidenceStorageConfigured(env) {
  return Boolean(
    env.S3_BUCKET
    && env.S3_ENDPOINT
    && env.S3_ACCESS_KEY_ID
    && env.S3_SECRET_ACCESS_KEY
  );
}

function unavailableSessionStore() {
  const fail = async () => {
    throw new DatabaseConfigurationError();
  };
  return { create: fail, get: fail, save: fail, kind: 'unavailable' };
}

function unavailableCourseRunStore() {
  const fail = async () => {
    throw new DatabaseConfigurationError();
  };
  return { read: fail, transaction: fail, kind: 'unavailable' };
}

function unavailableEvidenceStore() {
  const fail = async () => {
    throw new DatabaseConfigurationError('生产证据存储尚未配置。');
  };
  return { put: fail, get: fail, findById: fail, kind: 'unavailable' };
}

async function dependencyConfiguration(env, { databasePool, databaseProbe }) {
  const persistentStateRequired = ['preview', 'production'].includes(env.APP_ENV);
  const evidenceStorageRequired = persistentStateRequired || env.EVIDENCE_UPLOAD_MODE === 'direct';
  const dependencies = {
    ai: {
      required: env.AI_ENABLED,
      configured: Boolean(env.OPENAI_BASE_URL && env.OPENAI_API_KEY && env.OPENAI_MODEL),
      healthy: Boolean(env.OPENAI_BASE_URL && env.OPENAI_API_KEY && env.OPENAI_MODEL),
    },
    database: {
      required: persistentStateRequired,
      configured: Boolean(env.DATABASE_URL && databasePool),
      healthy: false,
      schemaReady: false,
      latencyMs: null,
    },
    evidenceStorage: {
      required: evidenceStorageRequired,
      configured: evidenceStorageConfigured(env),
    },
  };
  dependencies.evidenceStorage.healthy = dependencies.evidenceStorage.configured;
  if (dependencies.database.configured) {
    try {
      const result = await databaseProbe(databasePool);
      dependencies.database.healthy = Boolean(result.healthy);
      dependencies.database.schemaReady = Boolean(result.schemaReady);
      dependencies.database.latencyMs = result.latencyMs;
    } catch {
      // Readiness deliberately hides database hosts, credentials and raw errors.
    }
  }
  return dependencies;
}

export async function buildApp({
  env,
  llm: providedLLM,
  sessionStore: providedSessionStore,
  courseRunStore: providedCourseRunStore,
  evidenceStore: providedEvidenceStore,
  getCourse: providedGetCourse,
  databasePool: providedDatabasePool,
  learnerRequestStore: providedLearnerRequestStore,
  databaseProbe = probeDatabase,
  serveStatic = true,
  realtimeMode = 'websocket',
} = {}) {
  const app = Fastify({ logger: { level: env.LOG_LEVEL || 'info' } });
  const lessonsRoot = env.lessonsRoot || path.resolve(env.projectRoot, '../6-lessons');
  const ownsDatabasePool = Boolean(env.DATABASE_URL && !providedDatabasePool);
  const databasePool = providedDatabasePool || (env.DATABASE_URL
    ? createDatabasePool({
      databaseUrl: env.DATABASE_URL,
      max: env.DB_POOL_MAX,
      connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
      queryTimeoutMillis: env.DB_QUERY_TIMEOUT_MS,
      idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
      maxLifetimeSeconds: env.DB_MAX_LIFETIME_SECONDS,
      logger: app.log,
    })
    : null);
  if (ownsDatabasePool) {
    app.addHook('onClose', async () => databasePool.end());
  }
  const persistentInfrastructureRequired = requiresPersistentInfrastructure(env);
  const store = providedSessionStore
    || (databasePool
      ? createPostgresSessionStore({ pool: databasePool })
      : (persistentInfrastructureRequired
        ? unavailableSessionStore()
        : createSessionStore({ baseDir: path.resolve(env.projectRoot, env.SESSION_STORE_DIR) })));
  const runStore = providedCourseRunStore
    || (databasePool
      ? createPostgresCourseRunStore({ pool: databasePool })
      : (persistentInfrastructureRequired
        ? unavailableCourseRunStore()
        : createCourseRunStore({ baseDir: path.resolve(env.projectRoot, env.SESSION_STORE_DIR) })));
  const learnerRequestStore = providedLearnerRequestStore
    || (databasePool
      ? createLearnerRequestStore({
        pool: databasePool,
        leaseMs: env.AI_REQUEST_LEASE_MS || 80_000,
      })
      : null);
  const realtime = createRealtimeHub();
  const llm = providedLLM || createLLM({
    baseUrl: env.OPENAI_BASE_URL,
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    wireApi: env.OPENAI_WIRE_API,
    toolMode: env.AI_TOOL_MODE,
    visionMode: env.AI_VISION_MODE,
    reasoningEffort: env.AI_REASONING_EFFORT,
    maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
    timeoutMs: env.AI_TIMEOUT_MS,
  });
  // 语义理解（D6 第一段）走独立的轻量客户端：不需要工具、不需要视觉，输出只有一个小 JSON。
  // 未配置 OPENAI_UNDERSTAND_MODEL 时复用主客户端，行为与配置前完全一致。
  const understandingLlm = (providedLLM || !env.OPENAI_UNDERSTAND_MODEL)
    ? llm
    : createLLM({
      baseUrl: env.OPENAI_BASE_URL,
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_UNDERSTAND_MODEL,
      wireApi: env.OPENAI_WIRE_API,
      toolMode: 'structured',
      visionMode: 'disabled',
      reasoningEffort: 'none',
      maxOutputTokens: 192,
      timeoutMs: env.AI_UNDERSTAND_TIMEOUT_MS,
    });
  const getCourse = providedGetCourse || ((courseId) => compileCourse({ lessonsRoot, courseId }));
  const evidenceStore = providedEvidenceStore
    || (persistentInfrastructureRequired && !evidenceStorageConfigured(env)
      ? unavailableEvidenceStore()
      : createEvidenceStore(env));
  const loadEvidence = async (id) => {
    if (!/^ev_[a-f0-9]+$/.test(id)) return null;
    const evidence = await evidenceStore.findById(id);
    if (!evidence) return null;
    const extension = path.extname(evidence.filename);
    const mimeType = evidence.contentType || [...EVIDENCE_TYPES.entries()].find(([, value]) => value === extension)?.[0] || 'application/octet-stream';
    return `data:${mimeType};base64,${evidence.data.toString('base64')}`;
  };
  const agent = createAgentService({
    llm,
    understandingLlm,
    understandingTimeoutMs: env.AI_UNDERSTAND_TIMEOUT_MS,
    store,
    getCourse,
    loadEvidence,
    logger: app.log,
  });
  const runtime = createCourseRunService({ store: runStore, getCourse, realtime });

  await app.register(cors, { origin: true });
  await app.register(multipart, {
    limits: { fileSize: env.MAX_UPLOAD_BYTES || 4_000_000, files: 1 },
  });
  const enableWebsocket = realtimeMode === 'websocket';
  if (enableWebsocket) await app.register(fastifyWebsocket);
  await registerRuntimeRoutes(app, {
    runtime,
    enableWebsocket,
    enableDemo: env.ENABLE_DEMO !== false,
  });

  app.get('/api/health', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    return {
      ok: true,
      service: 'forbidden-city-study-api',
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || 'local',
    };
  });

  app.get('/api/readiness', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    if (!secureTokenMatches(env.READINESS_TOKEN, readinessToken(request))) {
      reply.header('www-authenticate', 'Bearer');
      return reply.code(401).send({ error: '未授权访问 readiness。' });
    }
    const dependencies = await dependencyConfiguration(env, { databasePool, databaseProbe });
    const ready = Object.values(dependencies)
      .every((dependency) => !dependency.required || (dependency.configured && dependency.healthy));
    return reply.code(ready ? 200 : 503).send({ ok: ready, dependencies });
  });

  app.get('/api/map-config', async (request, reply) => {
    reply.header('cache-control', 'private, max-age=300');
    return {
      provider: 'amap',
      key: env.VITE_AMAP_KEY || '',
      securityCode: env.VITE_AMAP_SECURITY_CODE || '',
      style: env.VITE_AMAP_STYLE || 'amap://styles/normal',
    };
  });

  app.post('/api/sessions', async (request, reply) => {
    const input = sessionSchema.parse(request.body);
    const { session } = await agent.createSession(input);
    const binding = await runtime.bindLearnerSession({ ...input, sessionId: session.id });
    if (binding) {
      session.runId = binding.runId;
      session.participantId = binding.participantId;
      await store.save(session);
    }
    reply.code(201);
    return publicSession(session);
  });

  app.get('/api/sessions/:id', async (request, reply) => {
    const session = await store.get(request.params.id);
    if (!session) return reply.code(404).send({ error: '会话不存在。' });
    return publicSession(session);
  });

  app.post('/api/agent/turn', async (request, reply) => {
    const controller = new AbortController();
    let clientDisconnected = false;
    const abort = () => {
      clientDisconnected = true;
      if (!controller.signal.aborted) {
        controller.abort(new DOMException('客户端已取消请求。', 'AbortError'));
      }
    };
    const abortOnResponseClose = () => {
      if (!reply.raw.writableEnded) abort();
    };
    request.raw.once('aborted', abort);
    reply.raw.once('close', abortOnResponseClose);
    request.raw.socket?.once('close', abort);
    if (
      request.raw.aborted
      || request.raw.destroyed
      || request.raw.socket?.destroyed
      || reply.raw.destroyed
    ) abort();
    const turnDeadline = setTimeout(() => {
      if (!controller.signal.aborted) controller.abort(turnDeadlineError());
    }, env.AI_TURN_TIMEOUT_MS || 70_000);

    let input;
    let lease = null;
    let stream = null;
    let leaseCompleted = false;
    try {
      if (controller.signal.aborted) throw controller.signal.reason;
      if (!env.AI_ENABLED) {
        return reply.code(503).send({ error: 'AI 服务当前未启用。', code: 'AI_DISABLED' });
      }
      input = turnSchema.parse(request.body);
      lease = learnerRequestStore
        ? await learnerRequestStore.claim({
          sessionId: input.sessionId,
          requestId: input.requestId,
          requestHash: learnerRequestDigest(input),
        })
        : null;
      if (controller.signal.aborted) throw controller.signal.reason;
      if (lease?.status === 'pending') {
        return reply.code(409).send({
          error: '这个会话还有一条请求正在处理，请稍后重试。',
          code: 'SESSION_REQUEST_IN_PROGRESS',
          retryable: true,
          leaseExpiresAt: lease.leaseExpiresAt,
        });
      }
      stream = openSse(reply);
      if (controller.signal.aborted) throw controller.signal.reason;
      if (lease?.status === 'completed') {
        for (const event of lease.result?.events || []) stream.send(event.type, event.data);
        stream.end();
        return;
      }
      const persistSession = lease?.status === 'acquired'
        && typeof store.saveWithRequestResult === 'function'
        ? async ({ session, events }) => {
          await store.saveWithRequestResult(session, {
            requestId: input.requestId,
            leaseToken: lease.leaseToken,
            result: { events },
          });
          leaseCompleted = true;
        }
        : undefined;
      const result = await agent.runTurn({
        ...input,
        onTextDelta: (text) => stream.send('assistant.delta', { text }),
        signal: controller.signal,
        persistSession,
      });
      if (lease?.status === 'acquired' && !leaseCompleted) {
        await learnerRequestStore.complete({
          sessionId: input.sessionId,
          requestId: input.requestId,
          leaseToken: lease.leaseToken,
          result: { events: result.events },
        });
        leaseCompleted = true;
      }
      for (const event of result.events) stream.send(event.type, event.data);
    } catch (error) {
      if (lease?.status === 'acquired' && !leaseCompleted) {
        await learnerRequestStore.fail({
          sessionId: input.sessionId,
          requestId: input.requestId,
          leaseToken: lease.leaseToken,
          error,
        }).catch(() => undefined);
      }
      if (clientDisconnected) return;
      if (!stream) throw error;
      request.log.error({ err: error }, 'agent turn failed');
      if (error instanceof AgentActionError) {
        stream.send('agent.error', {
          kind: 'validation',
          code: error.code,
          message: error.message,
          details: error.details,
          retryable: false,
        });
      } else {
        stream.send('agent.error', {
          kind: 'connection',
          code: error?.code === 'AI_TURN_TIMEOUT' ? error.code : 'AGENT_TURN_FAILED',
          message: error?.code === 'AI_TURN_TIMEOUT'
            ? '这次回答用时过长，请重新发送刚才的内容。'
            : '连接这次中断了，请重新发送刚才的内容。',
          retryable: true,
        });
      }
    } finally {
      request.raw.removeListener('aborted', abort);
      reply.raw.removeListener('close', abortOnResponseClose);
      request.raw.socket?.removeListener('close', abort);
      clearTimeout(turnDeadline);
      stream?.end();
    }
  });

  app.post('/api/uploads', async (request, reply) => {
    const part = await request.file();
    if (!part) return reply.code(400).send({ error: '没有收到文件。' });
    const extension = EVIDENCE_TYPES.get(part.mimetype);
    if (!extension) return reply.code(415).send({ error: '当前仅支持常见图片或音频证据。' });
    const id = `ev_${crypto.randomUUID().replaceAll('-', '')}`;
    const filename = await evidenceStore.put({ id, extension, data: await part.toBuffer(), contentType: part.mimetype });
    reply.code(201);
    return { id, url: `/api/uploads/${filename}`, mimeType: part.mimetype, storage: evidenceStore.kind };
  });

  app.get('/api/uploads/:filename', async (request, reply) => {
    if (!/^ev_[a-f0-9]+\.[a-zA-Z0-9]+$/.test(request.params.filename)) return reply.code(404).send();
    const evidence = await evidenceStore.get(request.params.filename);
    if (!evidence) return reply.code(404).send();
    reply.type(evidence.contentType || path.extname(request.params.filename));
    return evidence.data;
  });

  app.post('/api/time-bank/answer', async (request) => {
    const body = z.object({
      sessionId: z.string(),
      taskId: z.string(),
      answer: z.unknown().optional(),
      evidence: z.array(z.object({ id: z.string(), url: z.string(), mimeType: z.string().optional() })).optional(),
      location: z.object({
        lng: z.coerce.number(), lat: z.coerce.number(), accuracyMeters: z.coerce.number().min(0).optional(),
      }).optional(),
    }).parse(request.body);
    return agent.answerTimeBank(body);
  });

  app.post('/api/time-bank/gift', async (request) => {
    const body = z.object({ sessionId: z.string(), roleId: z.string(), amount: z.coerce.number() }).parse(request.body);
    return agent.giftTime(body);
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'request failed');
    const status = error instanceof z.ZodError ? 400 : (error.statusCode || 500);
    reply.code(status).send({ error: status >= 500 ? '服务暂时不可用，请稍后重试。' : error.message });
  });

  if (serveStatic) {
    const teacherRoot = path.resolve(env.projectRoot, '../4-tea-leading');
    try {
      await fs.access(path.join(teacherRoot, 'index.html'));
      await app.register(fastifyStatic, {
        root: teacherRoot,
        prefix: '/teacher/',
        decorateReply: false,
      });
      app.get('/teacher', (request, reply) => reply.redirect('/teacher/'));
    } catch {
      // Teacher PWA is optional during isolated student-runtime tests.
    }

    const dist = path.resolve(env.projectRoot, 'dist');
    try {
      await fs.access(dist);
      await app.register(fastifyStatic, { root: dist, wildcard: false });
      app.get('/*', (request, reply) => reply.sendFile('index.html'));
    } catch {
      // Development uses Vite's dev server and proxy.
    }
  }

  return app;
}
