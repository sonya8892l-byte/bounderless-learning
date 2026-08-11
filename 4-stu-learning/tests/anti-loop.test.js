/**
 * 防循环回归集（决策 D6 / 实施计划 R1 的验收）。
 *
 * 治的是线上硬伤：学生说"我不知道从哪开始"，旧规则在"哪"上命中导航正则，
 * 于是同伴反复打开地图；学生说"你有毒吧"，同伴又把到达问题复读一遍。
 *
 * 这里的断言只管两件事，不去锁具体话术：
 *   ① 每句话都得到与它意思对应的动作（问路才给导航，求助给提示）；
 *   ② 连着两轮不许说同一句话。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { compileCourse, clearCourseCache } from '../server/course/compiler.js';
import { createAgentService } from '../server/agent/service.js';

const lessonsRoot = fileURLToPath(new URL('../../6-lessons/', import.meta.url));

function memoryStore() {
  const sessions = new Map();
  return {
    async create(values) {
      const session = {
        id: 'ses_anti_loop', courseId: values.courseId, roleId: values.roleId,
        studentId: values.studentId, groupId: values.groupId, phaseId: values.phaseId,
        phaseNumber: 2, currentTaskIndex: 0, scaffoldLevel: 0, completedTaskIds: [],
        events: [], messages: [], pendingTools: {}, handledRequestIds: [],
        timeBalance: 0, timeEarned: 0, completedBankTaskIds: [], gifts: [],
      };
      sessions.set(session.id, session);
      return session;
    },
    async get(id) { return sessions.get(id) || null; },
    async save(session) { sessions.set(session.id, session); return session; },
  };
}

// 按学生这句话的真实意思返回意图，模拟一个正常工作的轻量模型。
const INTENT_BY_TEXT = Object.freeze({
  你好: 'greeting',
  我不知道从哪开始: 'help_start',
  这是什么: 'asking_knowledge',
  我累了: 'emotional_low',
  直接告诉我答案: 'request_answer',
  太和殿在哪儿: 'asking_location',
  我做完了: 'claim_done',
  这个看不懂: 'help_stuck',
  今天天气真好: 'chat_offtopic',
  再来一遍: 'help_stuck',
});

function scriptedUnderstanding() {
  const seen = [];
  return {
    capabilities: () => ({ nativeTools: false, vision: false }),
    get seen() { return seen; },
    generate: async ({ messages }) => {
      const text = String(messages.at(-1)?.content || '');
      const intent = INTENT_BY_TEXT[text] || 'unknown';
      seen.push({ text, intent });
      return {
        text: JSON.stringify({
          intent,
          emotion: intent === 'emotional_low' ? 'tired' : 'neutral',
          answersPendingQuestion: false,
          pendingAnswer: 'unknown',
          want: '',
          confidence: 0.9,
        }),
        toolCalls: [],
      };
    },
  };
}

// 主模型：回声式生成，好让"是否复读"只取决于服务端逻辑而非桩的巧合。
function echoLlm() {
  let turn = 0;
  return {
    capabilities: () => ({ nativeTools: true, vision: false }),
    generate: async () => {
      turn += 1;
      return { text: `我听见了，我们接着聊第${turn}轮。`, toolCalls: [] };
    },
  };
}

async function harness() {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const understandingLlm = scriptedUnderstanding();
  const agent = createAgentService({
    llm: echoLlm(),
    understandingLlm,
    store: memoryStore(),
    getCourse: async () => course,
  });
  const { session } = await agent.createSession({
    courseId: course.id, roleId: 'dragon-counter', studentId: 's-anti-loop', groupId: 'g1',
  });
  return { agent, session, understandingLlm };
}

async function say(agent, session, text, index) {
  const result = await agent.runTurn({
    sessionId: session.id,
    requestId: `anti-loop-${index}`,
    input: { type: 'user_text', text },
  });
  const message = result.events.find((event) => event.type === 'assistant.completed');
  return {
    result,
    text: message?.data.text || '',
    intent: message?.data.intent || '',
    tools: result.events.filter((event) => event.type === 'tool.requested')
      .map((event) => event.data.payload.renderer),
  };
}

test('十句真实说法各自得到对应动作，且相邻两轮不复读', async () => {
  const { agent, session } = await harness();
  // 先过入场，让后续每句话都在"学习中"的状态下判定。
  await say(agent, session, '我已经到位，也准备好了', 'entry');

  const script = [
    '你好', '我不知道从哪开始', '这是什么', '我累了', '直接告诉我答案',
    '太和殿在哪儿', '我做完了', '这个看不懂', '今天天气真好', '再来一遍',
  ];
  const replies = [];
  for (const [index, text] of script.entries()) {
    const turn = await say(agent, session, text, index);
    assert.ok(turn.text.trim(), `“${text}”必须得到一句回应`);
    replies.push({ text, reply: turn.text, intent: turn.intent, tools: turn.tools });
  }

  // ① 相邻两轮不许一字不差地重复——这是"循环"的可观测定义。
  for (let index = 1; index < replies.length; index += 1) {
    assert.notEqual(
      replies[index].reply,
      replies[index - 1].reply,
      `第${index + 1}轮（${replies[index].text}）复读了上一轮的回复`,
    );
  }

  // ② 只有问路那一句可以开导航。求助、闲聊、情绪都不该弹地图。
  for (const entry of replies) {
    if (entry.text === '太和殿在哪儿') continue;
    assert.equal(
      entry.tools.includes('navigation'),
      false,
      `“${entry.text}”不是问路，不应打开导航`,
    );
  }
  assert.ok(
    replies.find((entry) => entry.text === '太和殿在哪儿').tools.includes('navigation'),
    '问路应打开导航',
  );
});

test('“我不知道从哪开始”给的是分级提示，不是地图', async () => {
  const { agent, session } = await harness();
  await say(agent, session, '我已经到位，也准备好了', 'entry');
  const turn = await say(agent, session, '我不知道从哪开始', 'help');

  assert.equal(turn.intent, 'task_help', '不知从哪开始属于求助，不是导航');
  assert.equal(turn.tools.includes('navigation'), false);
  assert.equal(
    turn.result.session.conversationState.recentTutorActions.at(-1).action,
    'give_scaffold',
  );
});

/**
 * 连续求助的正确解法是"换帮法"而不是"撤走帮助"。
 * 旧实现在第三次同类求助时把 give_scaffold 强制换成 redirect_task——学生第三次说
 * "这个看不懂"，得到的是"去用工具提交"。现在改为继续升档，档位到顶才转教师。
 */
test('同一句求助连问四次会逐档升到顶，不复读也不撤走帮助', async () => {
  const { agent, session } = await harness();
  await say(agent, session, '我已经到位，也准备好了', 'entry');

  const levels = [];
  const texts = [];
  for (let index = 0; index < 4; index += 1) {
    const turn = await say(agent, session, '这个看不懂', `stuck-${index}`);
    levels.push(turn.result.session.scaffoldLevel);
    texts.push(turn.text);
  }

  assert.ok(levels[1] > levels[0], `第二次求助应升档，实际 ${levels.join('→')}`);
  assert.ok(levels[3] > levels[1], `连续求助应持续升档，实际 ${levels.join('→')}`);
  assert.notEqual(texts[1], texts[0], '第二次求助不应复读第一次的提示');

  const actions = session.conversationState.recentTutorActions.map((entry) => entry.action);
  assert.equal(
    actions.slice(-4).every((action) => action === 'give_scaffold'),
    true,
    `连续求助期间不该撤走脚手架，实际动作序列 ${actions.join(',')}`,
  );
});

test('脚手架到顶后仍连续求助会转请老师，而不是继续复读最高档', async () => {
  const { agent, session } = await harness();
  await say(agent, session, '我已经到位，也准备好了', 'entry');

  const actions = [];
  for (let index = 0; index < 7; index += 1) {
    const turn = await say(agent, session, '这个看不懂', `exhaust-${index}`);
    actions.push(turn.result.session.conversationState.recentTutorActions.at(-1).action);
  }

  assert.equal(session.scaffoldLevel, 4, '连续求助应把档位推到平台上限');
  assert.ok(
    actions.includes('escalate_teacher'),
    `档位到顶后应转教师，实际动作序列 ${actions.join(',')}`,
  );
  assert.equal(
    actions.includes('redirect_task'),
    false,
    '求助回合不该被换成"去提交证据"',
  );
});

test('抱怨“你有毒吧”进入对话修复，不复读待答问题', async () => {
  const { agent, session } = await harness();
  const complaint = await say(agent, session, '你有毒吧', 'complaint');

  assert.equal(complaint.result.session.dialogueState.repairCount, 1);
  assert.equal(complaint.tools.length, 0, '修复回合不该顺带弹工具');
  assert.doesNotMatch(complaint.text, /到达了吗|准备好开始了吗/);
});

test('语义理解不可用时不回落到会循环的正则，仍然接住学生', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const agent = createAgentService({
    llm: echoLlm(),
    // 轻量模型整体不可用：understandTurn 应返回保守默认而非抛错。
    understandingLlm: {
      capabilities: () => ({ nativeTools: false, vision: false }),
      generate: async () => { throw new Error('understanding upstream down'); },
    },
    store: memoryStore(),
    getCourse: async () => course,
  });
  const { session } = await agent.createSession({
    courseId: course.id, roleId: 'dragon-counter', studentId: 's-degraded', groupId: 'g1',
  });

  const first = await say(agent, session, '我不知道从哪开始', 'down-1');
  const second = await say(agent, session, '我不知道从哪开始', 'down-2');

  assert.ok(first.text.trim(), '理解层挂掉也必须回一句');
  assert.equal(first.tools.includes('navigation'), false, '不许回落到导航正则');
  assert.notEqual(second.text, first.text, '降级路径同样不许复读');
});

test('语义理解不可用时入场流程仍能走通，不卡死在到达确认', async () => {
  clearCourseCache();
  const course = await compileCourse({ lessonsRoot, courseId: 'lesson_gewu_001' });
  const agent = createAgentService({
    llm: echoLlm(),
    understandingLlm: {
      capabilities: () => ({ nativeTools: false, vision: false }),
      generate: async () => { throw new Error('understanding upstream down'); },
    },
    store: memoryStore(),
    getCourse: async () => course,
  });
  const { session } = await agent.createSession({
    courseId: course.id, roleId: 'dragon-counter', studentId: 's-onboard-degraded', groupId: 'g1',
  });
  await agent.runTurn({
    sessionId: session.id,
    requestId: 'onboard-degraded-assign',
    input: { type: 'lifecycle_event', event: 'role_assigned' },
  });

  // 到达/就绪由确定性解析给出，所以轻量模型挂掉也不该阻塞进入任务阶段。
  const arrived = await say(agent, session, '我到了', 'onboard-degraded-arrived');
  assert.equal(arrived.result.session.dialogueState.confirmedSlots.arrival, true);

  const ready = await say(agent, session, '准备好了', 'onboard-degraded-ready');
  assert.equal(ready.result.session.dialogueState.confirmedSlots.readiness, true);
  assert.equal(
    ready.result.events.filter((event) => event.type === 'stage.started').length,
    1,
    '轻量模型挂掉也必须能进入第一个任务阶段',
  );
});
