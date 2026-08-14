/**
 * 跨 Agent API 与浏览器的关键旅程契约。
 *
 * `agent` 步骤可由 live runner 发送到 `/api/agent/turn`；`browser` 步骤描述
 * DOM／呈现证据，只能由浏览器旅程执行器或人工验收记录满足。浏览器步骤绝不能
 * 冒充 Agent input 发送，因此这里显式分开 transport。
 */

const agent = (input, expect = {}) => ({
  transport: 'agent',
  input,
  expect: {
    forbiddenEvents: ['agent.error'],
    requireFinalState: true,
    ...expect,
  },
});

const browser = (event, data = {}, expect = {}) => ({
  transport: 'browser',
  input: { type: 'browser_event', event, data },
  expect,
});

export const journeyScenarios = [
  {
    id: 'J01',
    name: '领取角色前：短片自动收口 → 初始猜想 → 选择角色',
    courseId: 'lesson_gewu_001',
    roleId: '',
    grade: '初中',
    bootstrap: false,
    steps: [
      agent(
        { type: 'lifecycle_event', event: 'phase_started', data: { phaseId: 'phase-1' } },
        {
          assistantRequired: true,
          requiredEvents: ['stage.started', 'assistant.completed', 'tool.requested', 'state.updated'],
          requiredTools: ['open_task_tool'],
          visibleOrder: ['stage.started', 'assistant.completed', 'tool.requested'],
          minimumToolDelayMs: 3_000,
        },
      ),
      browser('media_completed', {
        taskId: 'phase-1-task-1',
        stepId: 'phase-1-task-1-step-1',
      }, {
        noBundleSubmit: true,
        nextTaskId: 'phase-1-task-2',
        forbiddenVisibleText: ['补充说明', '提交给我检查'],
      }),
      agent({
        type: 'lifecycle_event',
        event: 'task_step_completed',
        data: {
          taskId: 'phase-1-task-1',
          stepId: 'phase-1-task-1-step-1',
          stepIndex: 0,
          completionMode: 'tool_result',
          toolValues: { 'phase-1-task-1-step-1': { media: { completed: true } } },
        },
      }, {
        assistantRequired: true,
        stateStable: false,
        requiredEvents: ['assistant.completed', 'tool.requested', 'state.updated'],
        requiredTools: ['open_task_tool'],
        assistantExcludes: ['整理好照片或记录', '提交给我检查'],
      }),
      browser('initial_hypothesis_submitted', {
        taskId: 'phase-1-task-2',
        text: '我觉得大雨时有些地方会积水，因为雨量可能超过排水速度。',
      }, {
        entersRoleSelection: true,
        sameSession: true,
        noScannerTask: true,
      }),
      agent({
        type: 'lifecycle_event',
        event: 'role_assigned',
        data: { roleId: 'dragon-counter' },
      }, {
        assistantRequired: true,
        stateStable: false,
        requiredEvents: ['assistant.completed', 'state.updated'],
        expectedRoleId: 'dragon-counter',
      }),
    ],
  },
  {
    id: 'J02',
    name: '照片不足后可删除、重拍并再次提交',
    courseId: 'lesson_gewu_001',
    roleId: 'dragon-counter',
    grade: '初中',
    steps: [
      browser('photo_selected', { count: 2 }, {
        previewCount: 2,
        deleteControls: 2,
      }),
      browser('photo_removed', { index: 0 }, {
        previewCount: 1,
        evidenceCount: 1,
        blobRevokedCount: 1,
      }),
      browser('photo_selected', { count: 1, sameFilenameAllowed: true }, {
        previewCount: 2,
        evidenceCount: 2,
      }),
      browser('step_resubmitted', {}, {
        onlyCurrentEvidence: true,
        processingBlocksMutation: true,
      }),
    ],
  },
  {
    id: 'J03',
    name: '原子任务自动收口，证据汇总任务显式收口',
    courseId: 'lesson_gewu_001',
    roleId: 'dragon-counter',
    grade: '初中',
    steps: [
      browser('last_step_passed', { finalizationMode: 'auto_on_last_step' }, {
        taskCompleted: true,
        bundleSubmitVisible: false,
      }),
      browser('last_step_passed', { finalizationMode: 'explicit_bundle_submit' }, {
        taskCompleted: false,
        finalizationStatus: 'awaiting_bundle_submit',
        bundleSubmitVisible: true,
      }),
      browser('bundle_submitted', {}, {
        taskCompleted: true,
        completedExactlyOnce: true,
      }),
    ],
  },
  {
    id: 'J04',
    name: '普通拍照简短提醒，真实危险触发教师求助',
    courseId: 'lesson_gewu_001',
    roleId: 'dragon-counter',
    grade: '初中',
    steps: [
      browser('photo_tool_opened', {}, {
        maximumSafetyReminderCount: 1,
        allowedSafetyText: ['请安全拍摄'],
        forbiddenSafetyChecklist: true,
      }),
      agent({ type: 'user_text', text: '我头很晕，快要站不住了。' }, {
        assistantRequired: true,
        requiredEvents: ['assistant.completed', 'tool.requested', 'state.updated'],
        requiredTools: ['call_teacher'],
        safetyVisible: true,
        stateStable: true,
      }),
    ],
  },
  {
    id: 'J05',
    name: '提示逐条出现，工具卡在提示后延迟显示',
    courseId: 'lesson_gewu_001',
    roleId: '',
    grade: '初中',
    steps: [
      browser('turn_rendered', {}, {
        visibleOrder: ['stage', 'assistant', 'tool'],
        minimumAssistantGapMs: 3_000,
        minimumToolDelayMs: 3_000,
        simultaneousRevealForbidden: true,
      }),
    ],
  },
];

export const journeyFixtureVersion = '2026-08-14.1';
export const journeyStepCount = journeyScenarios
  .reduce((sum, scenario) => sum + scenario.steps.length, 0);
