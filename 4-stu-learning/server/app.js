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
import { createFallbackLLM } from './services/fallback-llm.js';
import { createSessionStore } from './services/store.js';
import {
  AgentActionError,
  assertCourseContentVersion,
  createAgentService,
} from './agent/service.js';
import { learnerRequestDigest } from './agent/request-replay.js';
import { createStudentFacingPolicy } from './agent/student-facing-policy.js';
import { appendTurnTrace, buildTurnTrace, traceStateSnapshot } from './agent/turn-trace.js';
import { createCourseRunStore } from './runtime/course-run-store.js';
import { createCourseRunService } from './runtime/course-run-service.js';
import { createRealtimeHub } from './runtime/realtime.js';
import { registerRuntimeRoutes } from './runtime/routes.js';
import { createPostgresCourseRunStore, createPostgresSessionStore } from './runtime/postgres-store.js';
import { createEvidenceStore } from './services/evidence-store.js';
import { createDatabasePool, probeDatabase } from './database/pool.js';
import { CourseRunMutationConflictError, DatabaseConfigurationError } from './database/errors.js';
import { createLearnerRequestStore } from './database/learner-request-store.js';
import { effectiveAppEnvironment, qaForceCompleteEnabled } from './config/env.js';
import { GRADE_LEVELS } from '../src/engine/grade-level.js';
import { entryPhaseForLesson } from '../src/engine/entry-phase.js';
import { studentDialogueHistory } from './services/student-dialogue-history.js';

const sessionSchema = z.object({
  courseId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  roleId: z.string().regex(/^[a-zA-Z0-9_-]+$/).or(z.literal('')).optional().default(''),
  studentId: z.string().min(1).max(100),
  groupId: z.string().min(1).max(100),
  runId: z.string().min(1).max(100).optional(),
  participantId: z.string().min(1).max(100).optional(),
  joinCredential: z.string().min(32).max(200).optional(),
  grade: z.enum(GRADE_LEVELS).optional(),
  gradeSource: z.enum(['student_selected', 'participant_profile', 'url', 'evaluation']).optional(),
});

const resumeSessionSchema = z.object({
  runId: z.string().min(1).max(100),
  participantId: z.string().min(1).max(100),
  courseId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  joinCredential: z.string().min(32).max(200).optional(),
  grade: z.enum(GRADE_LEVELS).optional(),
  gradeSource: z.enum(['student_selected', 'participant_profile', 'url', 'evaluation']).optional(),
});

const claimRoleSchema = z.object({
  roleId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
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

const qaForceCompleteSchema = z.object({
  taskId: z.string().min(1).max(160),
  requestId: z.string().min(1).max(100),
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
    grade: session.grade,
    gradeSource: session.gradeSource || 'platform_default',
    phaseId: session.phaseId,
    phaseTaskContext: session.phaseTaskState || (!session.roleId ? {
      phaseId: session.phaseId,
      currentTaskIndex: session.currentTaskIndex,
      completedTaskIds: [...(session.completedTaskIds || [])],
      taskId: session.taskState?.taskId || '',
      guidanceStepIndex: Number(session.taskState?.guidanceStepIndex || 0),
    } : null),
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
    resumeState: {
      entryStarted: session.roleId
        ? (session.events || []).includes(`${session.roleId}:role-assigned`)
        : session.onboardingState?.completed === true,
    },
    updatedAt: session.updatedAt,
  };
}

function roleEntryTrack(course) {
  const phase = entryPhaseForLesson(course.lesson);
  return phase ? course.phaseTracks[phase.id] : null;
}

function assertRoleClaimPrerequisites(session, course) {
  const track = roleEntryTrack(course);
  if (!track?.tasks?.length || session.roleId) return;
  const completed = new Set(session.completedTaskIds || []);
  const missing = track.tasks.filter((task) => !completed.has(`${track.id}:${task.id}`));
  if (missing.length) {
    throw new AgentActionError(
      `请先完成“${missing[0].name}”，再领取角色。`,
      'PHASE_TASKS_INCOMPLETE',
      { missingTaskIds: missing.map((task) => task.id) },
    );
  }
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

function bearerToken(request) {
  const authorization = request.headers.authorization || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

function readinessToken(request) {
  return bearerToken(request) || request.headers['x-readiness-token'] || '';
}

/**
 * Bridges privileged Agent lifecycle events to the teacher runtime's
 * session-bound, one-shot command receipts.  A claim stays in memory while the
 * Agent validates and persists its state; only then is the receipt committed.
 */
export function createRuntimeTeacherCommandConsumer(runtime) {
  const activeClaims = new Set();
  return async ({ sessionId, input, requirement }) => {
    const commandId = String(requirement?.commandId || '').trim();
    const claimKey = `${sessionId}:${commandId}`;
    if (!commandId || activeClaims.has(claimKey)) {
      throw new AgentActionError(
        '这条教师指令无效或已经使用过，进度未改变。',
        'TEACHER_COMMAND_UNAUTHORIZED',
      );
    }
    activeClaims.add(claimKey);
    try {
      const pending = await runtime.commandsForSession(sessionId, 0);
      const command = (pending.commands || []).find((item) => item.id === commandId);
      if (!command || command.action !== requirement.action) {
        throw new AgentActionError(
          '这条教师指令不属于当前会话、已经使用，或与操作类型不匹配。',
          'TEACHER_COMMAND_UNAUTHORIZED',
        );
      }
      try {
        await runtime.assertCommandTargetCurrent(sessionId, command.id);
      } catch (error) {
        if (error.code === 'TEACHER_LOCATION_SNAPSHOT_STALE') {
          await runtime.confirmCommand(sessionId, command.id, 'failed').catch(() => undefined);
          throw new AgentActionError(error.message, error.code);
        }
        throw error;
      }

      // Privileged values come from the server-issued command payload.  The
      // browser contributes only its current task/step cursor, which is checked
      // again by Agent state validation below this boundary.
      const payload = command.payload || {};
      const targetSnapshot = command.receipt?.targetSnapshot || {};
      input.data ||= {};
      input.data.teacherCommandId = command.id;
      if (command.action === 'set_scaffold') {
        const level = Number(payload.level ?? 0);
        if (!Number.isFinite(level)) {
          throw new AgentActionError('教师指令中的脚手架等级无效。', 'TEACHER_COMMAND_INVALID');
        }
        input.data.scaffoldLevel = level;
        delete input.data.phaseId;
      }
      if (command.action === 'advance_phase') {
        const phaseId = String(payload.phaseId || '').trim();
        if (!phaseId) {
          throw new AgentActionError('教师指令缺少要进入的阶段。', 'TEACHER_COMMAND_INVALID');
        }
        input.data.phaseId = phaseId;
        if (payload.scaffoldLevel !== undefined && payload.scaffoldLevel !== null) {
          const level = Number(payload.scaffoldLevel);
          if (!Number.isFinite(level)) {
            throw new AgentActionError('教师指令中的脚手架等级无效。', 'TEACHER_COMMAND_INVALID');
          }
          input.data.scaffoldLevel = level;
        } else {
          delete input.data.scaffoldLevel;
        }
      }
      if (command.action === 'reject_evidence') {
        input.data.reason = String(payload.reason || payload.message || '');
      }
      for (const field of ['taskId', 'stepId']) {
        const authoritative = payload[field] ?? targetSnapshot[field];
        if (authoritative !== undefined && authoritative !== null && String(authoritative)) {
          input.data[field] = String(authoritative);
        }
      }
      if (targetSnapshot.locationObservedAt) {
        input.data.locationObservedAt = String(targetSnapshot.locationObservedAt);
      }

      let settled = false;
      return {
        sessionId,
        commandId: command.id,
        action: command.action,
        async commit() {
          if (settled) return;
          await runtime.confirmCommand(sessionId, command.id, 'delivered');
          settled = true;
          activeClaims.delete(claimKey);
        },
        async release() {
          if (settled) return;
          settled = true;
          activeClaims.delete(claimKey);
        },
      };
    } catch (error) {
      activeClaims.delete(claimKey);
      throw error;
    }
  };
}

function turnDeadlineError() {
  return Object.assign(new Error('本次 AI 请求超过整体处理时限。'), {
    name: 'TurnDeadlineError',
    code: 'AI_TURN_TIMEOUT',
    statusCode: 504,
  });
}

function requiresPersistentInfrastructure(env) {
  return ['preview', 'production'].includes(effectiveAppEnvironment(env));
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

async function dependencyConfiguration(env, { databasePool, databaseProbe, modelFallbacks = {} }) {
  const persistentStateRequired = ['preview', 'production'].includes(effectiveAppEnvironment(env));
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
  if (Object.keys(modelFallbacks).length) dependencies.ai.fallbacks = modelFallbacks;
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
  evaluationLlm: providedEvaluationLLM,
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
  const appEnvironment = effectiveAppEnvironment(env);
  const hostedEnvironment = ['preview', 'production'].includes(appEnvironment);
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
  const understandingPrimaryLlm = (!providedLLM && env.OPENAI_UNDERSTAND_MODEL)
    ? createLLM({
      // 轻量模型可以在另一个服务商；三项默认沿用主模型那套。
      baseUrl: env.OPENAI_UNDERSTAND_BASE_URL || env.OPENAI_BASE_URL,
      apiKey: env.OPENAI_UNDERSTAND_API_KEY || env.OPENAI_API_KEY,
      model: env.OPENAI_UNDERSTAND_MODEL,
      wireApi: env.OPENAI_UNDERSTAND_WIRE_API || env.OPENAI_WIRE_API,
      toolMode: 'structured',
      visionMode: 'disabled',
      reasoningEffort: 'none',
      maxOutputTokens: 192,
      timeoutMs: env.AI_UNDERSTAND_PRIMARY_TIMEOUT_MS || 3_500,
    })
    : null;
  const understandingLlm = understandingPrimaryLlm
    ? createFallbackLLM({
      primary: understandingPrimaryLlm,
      fallback: llm,
      purpose: 'understanding',
      logger: app.log,
    })
    : llm;
  // AI 验收有独立客户端：结构化小结果不需要主对话的工具能力和推理预算，
  // 但需要比普通回复更宽的等待窗口。显式配置时也可以迁到专用模型／服务商。
  const evaluationFallbackLlm = providedLLM
    ? llm
    : createLLM({
      baseUrl: env.OPENAI_BASE_URL,
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
      wireApi: env.OPENAI_WIRE_API,
      toolMode: 'structured',
      visionMode: env.AI_VISION_MODE,
      reasoningEffort: 'none',
      maxOutputTokens: 192,
      timeoutMs: env.AI_EVALUATION_TIMEOUT_MS || 28_000,
    });
  const hasDedicatedEvaluation = Boolean(
    env.OPENAI_EVALUATION_MODEL
    || env.OPENAI_EVALUATION_BASE_URL
    || env.OPENAI_EVALUATION_API_KEY
    || env.OPENAI_EVALUATION_WIRE_API
  );
  const evaluationPrimaryLlm = (!providedLLM && hasDedicatedEvaluation)
    ? createLLM({
      baseUrl: env.OPENAI_EVALUATION_BASE_URL || env.OPENAI_BASE_URL,
      apiKey: env.OPENAI_EVALUATION_API_KEY || env.OPENAI_API_KEY,
      model: env.OPENAI_EVALUATION_MODEL || env.OPENAI_MODEL,
      wireApi: env.OPENAI_EVALUATION_WIRE_API || env.OPENAI_WIRE_API,
      toolMode: 'structured',
      visionMode: env.AI_VISION_MODE,
      reasoningEffort: 'none',
      maxOutputTokens: 192,
      timeoutMs: env.AI_EVALUATION_TIMEOUT_MS || 28_000,
    })
    : null;
  const evaluationLlm = providedEvaluationLLM || (evaluationPrimaryLlm
    ? createFallbackLLM({
      primary: evaluationPrimaryLlm,
      fallback: evaluationFallbackLlm,
      purpose: 'evaluation',
      logger: app.log,
    })
    : evaluationFallbackLlm);
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
  const hostedJoinCredentialRequired = hostedEnvironment;
  const testJoinCredentialRequired = appEnvironment === 'test' && env.JOIN_CREDENTIAL_BYPASS !== true;
  const resolveLearnerProjection = async (sessionId) => {
    const session = await store.get(sessionId);
    if (!session?.runId || !session?.participantId) return null;
    const course = await getCourse(session.courseId);
    const track = session.roleId
      ? course.roles.find((role) => role.id === session.roleId)
      : course.phaseTracks?.[session.phaseId];
    const tasks = track?.tasks || [];
    const taskIndex = Math.min(
      Math.max(0, Number(session.currentTaskIndex || 0)),
      Math.max(0, tasks.length - 1),
    );
    const task = tasks[taskIndex] || null;
    const stepIndex = Math.max(0, Number(session.taskState?.guidanceStepIndex || 0));
    const step = task?.steps?.[stepIndex] || null;
    const stepAttempts = step
      ? Math.max(0, Number(session.taskState?.stepAttempts?.[step.id] || 0))
      : 0;
    const stepMaxAttempts = step ? Math.max(0, Number(step.maxAttempts || 0)) : 0;
    const taskFinalizationStatus = String(session.taskState?.finalization?.status || '');
    const teacherApprovalKind = step?.completionMode === 'teacher_confirm'
      ? 'step_teacher_confirm'
      : step?.completionMode === 'ai_evaluation'
        && stepMaxAttempts > 0
        && stepAttempts >= stepMaxAttempts
        ? 'ai_max_attempts'
        : taskFinalizationStatus === 'awaiting_teacher_confirm'
          ? 'task_teacher_confirm'
          : '';
    const completedPrefix = `${track?.id || session.roleId || session.phaseId}:`;
    const completedCount = (session.completedTaskIds || [])
      .filter((taskId) => taskId.startsWith(completedPrefix)).length;
    const lastActionAt = session.taskState?.lastMeaningfulActionAt || null;
    const parsedLastActionAt = Date.parse(lastActionAt || '');
    return {
      sessionId: session.id,
      runId: session.runId,
      participantId: session.participantId,
      roleId: session.roleId || '',
      progress: tasks.length ? Math.round((Math.min(tasks.length, completedCount) / tasks.length) * 100) : 0,
      currentTask: task?.name || '待开始',
      currentTaskId: task?.id || session.taskState?.taskId || '',
      currentStepId: step?.id || session.learningState?.stepId || '',
      currentStepName: step?.name || step?.studentAction || step?.objective || '',
      currentStepCompletionMode: step?.completionMode || '',
      currentStepAttempts: stepAttempts,
      currentStepMaxAttempts: stepMaxAttempts,
      taskFinalizationStatus,
      teacherApprovalAllowed: Boolean(teacherApprovalKind),
      teacherApprovalKind,
      pendingAdvanceMode: session.pendingAdvance?.taskId === task?.id
        ? String(session.pendingAdvance.mode || '')
        : '',
      evidenceCount: Array.isArray(session.learningState?.evidenceIds)
        ? session.learningState.evidenceIds.length
        : 0,
      idleSeconds: Number.isFinite(parsedLastActionAt)
        ? Math.max(0, Math.floor((Date.now() - parsedLastActionAt) / 1000))
        : 0,
      lastMeaningfulActionAt: lastActionAt,
    };
  };
  const runtime = createCourseRunService({
    store: runStore,
    getCourse,
    realtime,
    requireJoinCredential: hostedJoinCredentialRequired || testJoinCredentialRequired,
  });
  const roleClaimQueues = new Map();

  async function serializeRoleClaim(sessionId, operation) {
    const previous = roleClaimQueues.get(sessionId) || Promise.resolve();
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const tail = previous.catch(() => undefined).then(() => gate);
    roleClaimQueues.set(sessionId, tail);
    await previous.catch(() => undefined);
    try {
      return await operation();
    } finally {
      release();
      if (roleClaimQueues.get(sessionId) === tail) roleClaimQueues.delete(sessionId);
    }
  }

  async function assertFirstRoleUsesEntrySession(input, validatedBinding) {
    if (!input.roleId || !validatedBinding) return;
    if (validatedBinding.runState.claimedRoleId) {
      if (validatedBinding.runState.claimedRoleId === input.roleId) {
        const existing = await runtime.resumeLearnerSession(input);
        if (existing.sessionId) {
          throw new AgentActionError(
            '这个角色已有学习会话，请恢复原会话继续，避免丢失进度。',
            'COURSE_ROLE_SESSION_EXISTS',
            { sessionId: existing.sessionId, runState: existing.runState },
          );
        }
      }
      return;
    }
    const course = await getCourse(input.courseId);
    const track = roleEntryTrack(course);
    if (!track?.tasks?.length) return;

    const currentBinding = await runtime.resumeLearnerSession(input);
    if (!currentBinding.sessionId) {
      assertRoleClaimPrerequisites({ roleId: '', completedTaskIds: [] }, course);
    }
    const phaseSession = await store.get(currentBinding.sessionId);
    if (!phaseSession) {
      throw new AgentActionError(
        '选择角色前的学习会话已经失效，请重新进入课程。',
        'SESSION_RESUME_STALE_BINDING',
      );
    }
    assertCourseContentVersion(phaseSession, course);
    assertRoleClaimPrerequisites(phaseSession, course);
    throw new AgentActionError(
      '请在已经完成课程导入的会话中领取角色，学习记录会继续保留。',
      'PHASE_SESSION_REUSE_REQUIRED',
      { sessionId: phaseSession.id },
    );
  }

  async function assertLearnerRunAllowsTurn(sessionId, turnInput) {
    const session = await store.get(sessionId);
    if (!session?.runId) return null;
    const runState = await runtime.runStateForSession(sessionId);
    if (!runState || runState.runId !== session.runId || runState.courseId !== session.courseId) {
      throw new AgentActionError(
        '这个学习会话已不是当前教师场次的活动会话。',
        'COURSE_SESSION_INACTIVE',
        { runState },
      );
    }
    if (runState.status !== 'active') {
      if (runState.status === 'completed') {
        throw new AgentActionError('本次课程已结束，学习记录已转为只读。', 'COURSE_RUN_COMPLETED', { runState });
      }
      throw new AgentActionError('课程尚未开始，请等待老师发出开始指令。', 'COURSE_RUN_NOT_ACTIVE', { runState });
    }
    if (runState.rallyActive) {
      throw new AgentActionError('请先按老师要求前往集合点。', 'COURSE_RUN_RALLY_ACTIVE', { runState });
    }
    if (runState.paused) {
      throw new AgentActionError('课程已暂停，请留在安全位置等待老师恢复。', 'COURSE_RUN_PAUSED', { runState });
    }
    if (session.roleId && runState.claimedRoleId !== session.roleId) {
      throw new AgentActionError(
        '该角色会话已不是当前活动轨道，请恢复老师场次中的当前会话。',
        'COURSE_SESSION_INACTIVE',
        { runState },
      );
    }
    if (
      turnInput?.type === 'lifecycle_event'
      && turnInput.event === 'role_assigned'
    ) {
      const requestedRoleId = String(turnInput.data?.roleId || '');
      if (runState.claimedRoleId !== requestedRoleId) {
        if (runState.rolesReleased !== true || runState.rolesLocked === true) {
          throw new AgentActionError('老师还没有开放角色选择。', 'COURSE_ROLES_LOCKED', { runState });
        }
        throw new AgentActionError(
          '请先在角色选择页完成领取，再进入角色任务。',
          'COURSE_ROLE_CLAIM_REQUIRED',
          { runState },
        );
      }
    }
    return runState;
  }

  async function authorizedEvidenceSession(sessionId) {
    const normalizedSessionId = String(sessionId || '').trim();
    if (!normalizedSessionId) {
      throw new AgentActionError('上传证据需要有效的学习会话。', 'EVIDENCE_SESSION_REQUIRED');
    }
    const session = await store.get(normalizedSessionId);
    if (!session) {
      throw new AgentActionError('当前学习会话已失效，请重新进入课程后上传。', 'EVIDENCE_SESSION_INVALID');
    }
    await assertLearnerRunAllowsTurn(session.id);
    return session;
  }

  async function evidenceOwnedBySession(session, references = []) {
    const validated = [];
    for (const reference of references) {
      if (!/^ev_[a-f0-9]+$/.test(String(reference?.id || ''))) {
        throw new AgentActionError('证据标识无效，请重新上传。', 'EVIDENCE_REFERENCE_INVALID');
      }
      const stored = await evidenceStore.findById(reference.id);
      if (!stored) {
        throw new AgentActionError('证据已不存在，请重新上传。', 'EVIDENCE_NOT_FOUND');
      }
      const owner = stored.owner;
      const ownerMatches = owner?.sessionId === session.id
        && (owner.runId || null) === (session.runId || null)
        && (owner.participantId || null) === (session.participantId || null);
      if (!ownerMatches) {
        throw new AgentActionError(
          '这份证据不属于当前学习会话，请在本会话中重新上传。',
          'EVIDENCE_OWNERSHIP_MISMATCH',
        );
      }
      const extension = path.extname(stored.filename);
      const mimeType = stored.contentType
        || [...EVIDENCE_TYPES.entries()].find(([, value]) => value === extension)?.[0]
        || 'application/octet-stream';
      validated.push({
        id: reference.id,
        url: `/api/uploads/${stored.filename}`,
        mimeType,
      });
    }
    return validated;
  }

  const agent = createAgentService({
    llm,
    evaluationLlm,
    understandingLlm,
    understandingTimeoutMs: env.AI_UNDERSTAND_TIMEOUT_MS,
    store,
    getCourse,
    loadEvidence,
    logger: app.log,
    consumeTeacherCommand: createRuntimeTeacherCommandConsumer(runtime),
    persistLearnerMutation: (session, runtimeGuard) => store.save(session, { runtimeGuard }),
  });
  const modelFallbackStatus = () => Object.fromEntries([
    ['understanding', understandingLlm],
    ['evaluation', evaluationLlm],
  ].filter(([, client]) => typeof client?.status === 'function')
    .map(([name, client]) => [name, client.status()]));

  await app.register(cors, { origin: true });
  await app.register(multipart, {
    limits: { fileSize: env.MAX_UPLOAD_BYTES || 4_000_000, files: 1 },
  });
  const enableWebsocket = realtimeMode === 'websocket';
  if (enableWebsocket) await app.register(fastifyWebsocket);
  await registerRuntimeRoutes(app, {
    runtime,
    enableWebsocket,
    enableDemo: !hostedEnvironment && env.ENABLE_DEMO !== false,
    teacherAccess: {
      required: hostedEnvironment,
      token: env.TEACHER_API_TOKEN || '',
      teacherId: env.TEACHER_ID || 'teacher-primary',
    },
    resolveLearnerProjection,
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
    const dependencies = await dependencyConfiguration(env, {
      databasePool,
      databaseProbe,
      modelFallbacks: modelFallbackStatus(),
    });
    const ready = Object.values(dependencies)
      .every((dependency) => !dependency.required || (dependency.configured && dependency.healthy));
    return reply.code(ready ? 200 : 503).send({ ok: ready, dependencies });
  });

  app.get('/api/map-config', async (request, reply) => {
    if (hostedEnvironment) {
      if (!String(env.TEACHER_API_TOKEN || '')) {
        return reply.code(503).send({ error: '教师端认证尚未配置。' });
      }
      if (!secureTokenMatches(env.TEACHER_API_TOKEN, bearerToken(request))) {
        reply.header('www-authenticate', 'Bearer');
        return reply.code(401).send({ error: '教师端认证失败。' });
      }
    }
    reply.header('cache-control', 'private, max-age=300');
    return {
      provider: 'amap',
      key: env.VITE_AMAP_KEY || '',
      securityCode: env.VITE_AMAP_SECURITY_CODE || '',
      style: env.VITE_AMAP_STYLE || 'amap://styles/normal',
    };
  });

  // 课程枚举：给教师端"新建开课"抽屉拉下拉列表用。
  // 只回 id/title/series 元信息——列表接口不该把 roles/knowledge 等整包课程泄给前端。
  // 单门课编译失败只跳过该门并记日志，不许把整门列表拖成 500。
  app.get('/api/courses', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const entries = await fs.readdir(lessonsRoot, { withFileTypes: true });
    const courseIds = entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('lesson_'))
      .map((entry) => entry.name)
      .sort();
    const courses = [];
    for (const courseId of courseIds) {
      try {
        const course = await getCourse(courseId);
        courses.push({
          id: course.id,
          title: course.lesson?.title || '',
          series: course.lesson?.series || '',
        });
      } catch (error) {
        app.log.warn({ err: error, courseId }, '课程编译失败，已从 /api/courses 列表中跳过。');
      }
    }
    return { courses };
  });

  app.post('/api/sessions', async (request, reply) => {
    const input = sessionSchema.parse(request.body);
    if (hostedEnvironment && !input.runId) {
      return reply.code(422).send({
        error: '托管环境只能通过老师发放的正式场次链接进入课程。',
        code: 'COURSE_RUN_REQUIRED',
        retryable: false,
      });
    }
    // 指定教师场次的会话先校验权威 participantId，再写入 Agent store。
    // 这样绑定失败会明确返回 422，也不会留下无法使用的孤儿会话。
    const validatedBinding = input.runId ? await runtime.validateLearnerBinding(input) : null;
    if (validatedBinding?.runState.status === 'completed') {
      return reply.code(409).send({
        error: '本次课程已结束，不能新建学习会话。',
        code: 'COURSE_RUN_COMPLETED',
        retryable: false,
      });
    }
    if (
      input.roleId
      && validatedBinding
      && validatedBinding.runState.claimedRoleId !== input.roleId
      && (validatedBinding.runState.rolesReleased !== true || validatedBinding.runState.rolesLocked === true)
    ) {
      return reply.code(409).send({
        error: '老师还没有开放角色选择。',
        code: 'COURSE_ROLES_LOCKED',
        retryable: false,
      });
    }
    await assertFirstRoleUsesEntrySession(input, validatedBinding);
    const { session } = await agent.createSession(input);
    let binding;
    try {
      // 会话创建与场次绑定分属两个存储；最终绑定会在事务内
      // 重查结束/角色锁。若教师在两步之间改变状态，删除还未对学生暴露的孤儿会话。
      binding = await runtime.bindLearnerSession({ ...input, sessionId: session.id });
    } catch (error) {
      await store.remove?.(session.id);
      throw error;
    }
    if (input.runId && !binding) {
      throw Object.assign(new Error('学生身份与指定的课程场次不匹配。'), { statusCode: 422 });
    }
    if (binding) {
      session.runId = binding.runId;
      session.participantId = binding.participantId;
      await store.save(session);
      if (input.roleId) {
        await runtime.publishRoleClaimed({
          runId: binding.runId,
          participantId: binding.participantId,
          roleId: input.roleId,
        });
      }
    }
    reply.code(201);
    return {
      ...publicSession(session),
      // This is the student-safe subset of the authoritative course-run
      // snapshot. It lets a refresh restore role release/lock state before the
      // next command arrives, without exposing the roster or teacher API.
      teacherRunState: binding?.runState || null,
    };
  });

  app.post('/api/sessions/resume', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const input = resumeSessionSchema.parse(request.body);
    const binding = await runtime.resumeLearnerSession(input);
    if (!binding.sessionId) {
      return reply.code(404).send({
        error: '当前学生还没有可恢复的学习会话。',
        code: 'SESSION_RESUME_NOT_FOUND',
        retryable: false,
      });
    }

    const session = await store.get(binding.sessionId);
    const trustedIdentityMatches = session
      && session.runId === binding.runId
      && session.participantId === binding.participantId
      && session.courseId === binding.courseId;
    const currentRunState = trustedIdentityMatches
      ? await runtime.runStateForSession(session.id)
      : null;
    if (!trustedIdentityMatches || currentRunState?.runId !== binding.runId) {
      return reply.code(409).send({
        error: '当前绑定的学习会话已失效，请重新进入课程。',
        code: 'SESSION_RESUME_STALE_BINDING',
        retryable: false,
      });
    }

    const hasTrustedStoredGrade = GRADE_LEVELS.includes(session.grade)
      && session.gradeSource !== 'platform_default';
    if (!hasTrustedStoredGrade && input.grade) {
      session.grade = input.grade;
      session.gradeSource = input.gradeSource || 'student_selected';
      session.learnerState = {
        ...(session.learnerState || {}),
        grade: input.grade,
      };
      await store.save(session);
    }

    const activeToolCallId = String(session.learningState?.activeToolCallId || '');
    const activePendingTool = activeToolCallId
      ? session.pendingTools?.[activeToolCallId]
      : null;
    const safeActiveTool = activePendingTool?.payload
      ? {
          callId: activeToolCallId,
          name: String(activePendingTool.name || ''),
          payload: createStudentFacingPolicy({
            course: await getCourse(session.courseId),
            session,
          }).processSurface(activePendingTool.payload, { channel: 'resume_tool' }).value,
        }
      : null;

    return {
      ...publicSession(session),
      // 原始 session.messages 也承担 Agent Prompt 上下文，不能直接公开。
      // 这里只有凭证与场次身份均已通过校验，返回白名单投影供本人刷新恢复。
      dialogueHistory: studentDialogueHistory(session),
      pendingAdvance: session.pendingAdvance
        ? { mode: session.pendingAdvance.mode, taskId: session.pendingAdvance.taskId }
        : null,
      activeTool: safeActiveTool,
      teacherRunState: binding.runState,
      resumed: true,
    };
  });

  app.post('/api/sessions/:id/activate', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const session = await store.get(request.params.id);
    if (!session) return reply.code(404).send({ error: '会话不存在。' });
    // 激活只使用服务端已保存的身份，不接受客户端重传 runId / participantId。
    const binding = await runtime.activateLearnerSession({
      runId: session.runId,
      participantId: session.participantId,
      sessionId: session.id,
      courseId: session.courseId,
      roleId: session.roleId,
    });
    if (session.roleId) {
      await runtime.publishRoleClaimed({
        runId: binding.runId,
        participantId: binding.participantId,
        roleId: session.roleId,
      });
    }
    return {
      ...publicSession(session),
      teacherRunState: binding.runState,
    };
  });

  app.post('/api/sessions/:id/claim-role', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    const body = claimRoleSchema.parse(request.body);
    return serializeRoleClaim(request.params.id, async () => {
      // 排队后重新读取，防止两个并发请求都基于同一份 roleless 快照写入。
      const session = await store.get(request.params.id);
      if (!session) return reply.code(404).send({ error: '会话不存在。' });
      if (!session.runId || !session.participantId) {
        const course = await getCourse(session.courseId);
        assertCourseContentVersion(session, course);
        assertRoleClaimPrerequisites(session, course);
        await agent.claimRole({ sessionId: session.id, roleId: body.roleId });
        return {
          sessionId: session.id,
          roleId: body.roleId,
          teacherRunState: null,
        };
      }
      if (session.roleId && session.roleId !== body.roleId) {
        return reply.code(409).send({
          error: '当前会话已经绑定其他角色，请使用对应的角色会话。',
          code: 'ROLE_ALREADY_ASSIGNED',
        });
      }
      const course = await getCourse(session.courseId);
      assertCourseContentVersion(session, course);
      // 角色占位发生在场次存储中；必须先验证 Agent 会话已经完成入口任务，
      // 否则会出现“角色已被占用、会话仍停在选择前阶段”的半成功状态。
      assertRoleClaimPrerequisites(session, course);
      let binding;
      if (store.kind === 'postgres') {
        // Postgres session store 会在同一事务内锁定 course-runs 行、领取角色并
        // 写回 Agent 会话，正式环境不会出现只成功一半的角色状态。
        await agent.claimRole({ sessionId: session.id, roleId: body.roleId });
        binding = { runState: await runtime.runStateForSession(session.id) };
      } else {
        // 本地文件/测试存储没有跨 store 事务；先完成权威占位，再写 Agent。
        // 两步都可幂等重试，入口任务校验已在占位前完成。
        binding = await runtime.claimRoleForSession({
          runId: session.runId,
          participantId: session.participantId,
          sessionId: session.id,
          courseId: session.courseId,
          roleId: body.roleId,
        });
        await agent.claimRole({ sessionId: session.id, roleId: body.roleId });
      }
      await runtime.publishRoleClaimed({
        runId: session.runId,
        participantId: session.participantId,
        roleId: body.roleId,
      });
      return {
        sessionId: session.id,
        roleId: body.roleId,
        teacherRunState: binding.runState,
      };
    });
  });

  app.get('/api/sessions/:id', async (request, reply) => {
    const session = await store.get(request.params.id);
    if (!session) return reply.code(404).send({ error: '会话不存在。' });
    return publicSession(session);
  });

  app.post('/api/qa/sessions/:id/complete-current-task', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    // 隐藏前端按钮只负责交互；真正的越权门禁始终在服务端，并在生产环境硬关闭。
    if (!qaForceCompleteEnabled(env)) return reply.code(404).send({ error: '接口不存在。' });
    const body = qaForceCompleteSchema.parse(request.body);
    try {
      await assertLearnerRunAllowsTurn(request.params.id);
      const result = await agent.forceCompleteCurrentTask({
        sessionId: request.params.id,
        taskId: body.taskId,
        requestId: body.requestId,
      });
      return {
        events: result.events,
        qaOverride: result.qaOverride,
        advanced: result.advanced,
        allTasksCompleted: result.allTasksCompleted,
      };
    } catch (error) {
      if (error instanceof AgentActionError) {
        return reply.code(error.code === 'QA_SESSION_NOT_FOUND' ? 404 : 409).send({
          error: error.message,
          code: error.code,
          details: error.details,
        });
      }
      throw error;
    }
  });

  app.post('/api/agent/turn', async (request, reply) => {
    const turnStartedAt = Date.now();
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
      await assertLearnerRunAllowsTurn(input.sessionId, input.input);
      if (input.input.type === 'tool_result' && input.input.result.evidence?.length) {
        const session = await authorizedEvidenceSession(input.sessionId);
        input.input.result.evidence = await evidenceOwnedBySession(
          session,
          input.input.result.evidence,
        );
      }
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
      const completedReplay = lease?.status === 'completed'
        ? await agent.replayCompletedRequest({
          sessionId: input.sessionId,
          requestId: input.requestId,
          input: input.input,
          replayEnvelope: lease.result,
        })
        : null;
      stream = openSse(reply);
      if (controller.signal.aborted) throw controller.signal.reason;
      if (lease?.status === 'completed') {
        for (const event of completedReplay.events) stream.send(event.type, event.data);
        stream.end();
        return;
      }
      const persistSession = async ({ session, replayEnvelope, runtimeGuard }) => {
        // 教师可能在模型生成期间暂停或结束场次；落盘前再查一次，
        // 防止这个早已开始的回合在锁定后继续推进学习状态。
        await assertLearnerRunAllowsTurn(session.id, input.input);
        if (lease?.status === 'acquired' && typeof store.saveWithRequestResult === 'function') {
          await store.saveWithRequestResult(session, {
            requestId: input.requestId,
            leaseToken: lease.leaseToken,
            result: replayEnvelope,
            runtimeGuard,
          });
          leaseCompleted = true;
          return;
        }
        await store.save(session, { runtimeGuard });
      };
      const approvedDeltas = [];
      const result = await agent.runTurn({
        ...input,
        // service 只会回调已经过完整 StudentFacingPolicy 的文本；这里仍先缓冲，
        // 等 session/请求租约原子持久化成功后才让学生看到。
        onTextDelta: (text) => approvedDeltas.push(text),
        signal: controller.signal,
        persistSession,
      });
      if (lease?.status === 'acquired' && !leaseCompleted) {
        await learnerRequestStore.complete({
          sessionId: input.sessionId,
          requestId: input.requestId,
          leaseToken: lease.leaseToken,
          result: result.replayEnvelope,
        });
        leaseCompleted = true;
      }
      for (const text of approvedDeltas) stream.send('assistant.delta', { text });
      for (const event of result.events) stream.send(event.type, event.data);
    } catch (error) {
      const validationError = error instanceof AgentActionError
        || error instanceof CourseRunMutationConflictError;
      const errorIntent = validationError ? 'validation_error' : 'connection_error';
      let publicError = validationError
        ? {
          kind: 'validation',
          code: error.code,
          message: error.message,
          details: error.details,
          retryable: false,
        }
        : {
          kind: 'connection',
          code: error?.code === 'AI_TURN_TIMEOUT' ? error.code : 'AGENT_TURN_FAILED',
          message: error?.code === 'AI_TURN_TIMEOUT'
            ? '这次回答用时过长，请重新发送刚才的内容。'
            : '连接这次中断了，请重新发送刚才的内容。',
          retryable: true,
        };
      let failureTrace = null;
      try {
        const errorSession = input?.sessionId ? await store.get(input.sessionId) : null;
        const errorCourse = errorSession ? await getCourse(errorSession.courseId) : null;
        const errorPolicy = errorSession && errorCourse
          ? createStudentFacingPolicy({ course: errorCourse, session: errorSession })
          : null;
        const policyActions = [];
        if (errorPolicy) {
          const messageResult = errorPolicy.processText(publicError.message, {
            channel: 'error',
            intent: errorIntent,
            dedupe: false,
          });
          const detailsResult = errorPolicy.processSurface(publicError.details, {
            channel: 'error_details',
          });
          publicError = {
            ...publicError,
            message: messageResult.text,
            details: detailsResult.value,
          };
          policyActions.push(
            ...messageResult.actions.map((action) => `error:${action}`),
            ...detailsResult.actions,
          );
        }
        if (errorSession && errorCourse) {
          const snapshot = traceStateSnapshot(errorSession);
          failureTrace = buildTurnTrace({
            requestId: input?.requestId,
            startedAt: turnStartedAt,
            course: errorCourse,
            input: input?.input,
            stateBefore: snapshot,
            stateAfter: snapshot,
            decision: { decisionSource: 'request_error', intent: errorIntent },
            outputPath: `error:${publicError.kind}`,
            outputText: publicError.message,
            events: [{ type: 'agent.error', data: {} }],
            policyVersion: errorPolicy?.version || '',
            policyActions,
            status: 'failed',
            errorCode: publicError.code,
          });
          appendTurnTrace(errorSession, failureTrace);
          // 失败回合不保存运行中的半成品状态；只将从持久层重新
          // 读取的稳定会话加上最小 trace 后写回。
          await store.save(errorSession);
        }
      } catch (traceError) {
        request.log.warn({ err: traceError }, 'failed turn trace unavailable');
      }
      if (lease?.status === 'acquired' && !leaseCompleted) {
        await learnerRequestStore.fail({
          sessionId: input.sessionId,
          requestId: input.requestId,
          leaseToken: lease.leaseToken,
          error,
          trace: failureTrace,
        }).catch(() => undefined);
      }
      if (clientDisconnected) return;
      if (!stream) throw error;
      request.log.error({ err: error }, 'agent turn failed');
      stream.send('agent.error', publicError);
    } finally {
      request.raw.removeListener('aborted', abort);
      reply.raw.removeListener('close', abortOnResponseClose);
      request.raw.socket?.removeListener('close', abort);
      clearTimeout(turnDeadline);
      stream?.end();
    }
  });

  app.post('/api/uploads', async (request, reply) => {
    const session = await authorizedEvidenceSession(request.headers['x-agent-session-id']);
    const part = await request.file();
    if (!part) return reply.code(400).send({ error: '没有收到文件。' });
    const extension = EVIDENCE_TYPES.get(part.mimetype);
    if (!extension) return reply.code(415).send({ error: '当前仅支持常见图片或音频证据。' });
    const data = await part.toBuffer();
    // 读取文件期间教师可能暂停或结束场次；写入存储前再校验。
    await authorizedEvidenceSession(session.id);
    const id = `ev_${crypto.randomUUID().replaceAll('-', '')}`;
    const filename = await evidenceStore.put({
      id,
      extension,
      data,
      contentType: part.mimetype,
      owner: {
        sessionId: session.id,
        runId: session.runId || null,
        participantId: session.participantId || null,
      },
    });
    reply.code(201);
    return { id, url: `/api/uploads/${filename}`, mimeType: part.mimetype, storage: evidenceStore.kind };
  });

  app.get('/api/uploads/:filename', async (request, reply) => {
    if (!/^ev_[a-f0-9]+\.[a-zA-Z0-9]+$/.test(request.params.filename)) return reply.code(404).send();
    const evidence = await evidenceStore.get(request.params.filename);
    if (!evidence) return reply.code(404).send();
    const owner = evidence.owner;
    if (!owner?.sessionId) {
      return reply.code(403).send({ error: '该证据没有可验证的归属，请重新上传。', code: 'EVIDENCE_OWNER_MISSING' });
    }
    const requesterSessionId = String(request.headers['x-agent-session-id'] || '').trim();
    let authorized = false;
    if (requesterSessionId) {
      const requesterSession = await store.get(requesterSessionId);
      authorized = Boolean(requesterSession && requesterSession.id === owner.sessionId);
    } else if (
      owner.runId
      && String(env.TEACHER_API_TOKEN || '')
      && secureTokenMatches(env.TEACHER_API_TOKEN, bearerToken(request))
    ) {
      await runtime.assertTeacherAccess(owner.runId, env.TEACHER_ID || 'teacher-primary');
      authorized = true;
    }
    if (!authorized) {
      const status = requesterSessionId || request.headers.authorization ? 403 : 401;
      return reply.code(status).send({
        error: '只有证据所属学习会话或该场次教师可以读取。',
        code: 'EVIDENCE_READ_FORBIDDEN',
      });
    }
    reply.header('cache-control', 'private, no-store');
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
    await assertLearnerRunAllowsTurn(body.sessionId);
    if (body.evidence?.length) {
      const session = await authorizedEvidenceSession(body.sessionId);
      body.evidence = await evidenceOwnedBySession(session, body.evidence);
    }
    return agent.answerTimeBank(body);
  });

  app.post('/api/time-bank/gift', async (request) => {
    const body = z.object({ sessionId: z.string(), roleId: z.string(), amount: z.coerce.number() }).parse(request.body);
    await assertLearnerRunAllowsTurn(body.sessionId);
    return agent.giftTime(body);
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'request failed');
    const learnerMutationConflict = error instanceof CourseRunMutationConflictError;
    const status = error instanceof z.ZodError
      ? 400
      : error instanceof AgentActionError || learnerMutationConflict
        ? 409
        : (error.statusCode || 500);
    reply.code(status).send({
      error: status >= 500 ? '服务暂时不可用，请稍后重试。' : error.message,
      ...(error instanceof AgentActionError || learnerMutationConflict ? {
        kind: 'validation', code: error.code, details: error.details, retryable: false,
      } : {}),
      ...(status < 500 && !(error instanceof AgentActionError) && !learnerMutationConflict && error.code ? {
        kind: 'validation', code: error.code, details: error.details, retryable: false,
      } : {}),
    });
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
