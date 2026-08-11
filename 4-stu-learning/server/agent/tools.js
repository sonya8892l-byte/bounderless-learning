import { currentTaskOf, currentToolOf } from './task-advance.js';

const objectSchema = (properties, required) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

export const TOOL_DEFINITIONS = [
  {
    name: 'open_task_tool',
    description: '打开当前任务配置好的交互工具。仅可使用系统上下文中给出的当前工具实例 ID。',
    parameters: objectSchema({
      toolInstanceId: { type: 'string', description: '课程配置中的工具实例 ID' },
      reason: { type: 'string', description: '用一句话说明为什么现在需要打开该工具' },
    }, ['toolInstanceId', 'reason']),
  },
  {
    name: 'show_navigation',
    description: '展示当前任务配置地点的导航卡。地点为空或不需要定位时不要调用。',
    parameters: objectSchema({
      taskId: { type: 'string', description: '当前任务 ID' },
    }, ['taskId']),
  },
  {
    name: 'retrieve_course_knowledge',
    description: '检索当前阶段和角色允许公开的课程知识。',
    parameters: objectSchema({
      query: { type: 'string', description: '需要检索的课程问题' },
    }, ['query']),
  },
  {
    name: 'call_teacher',
    description: '学生遇到危险、走失、受伤或明确要求老师帮助时发送求助。',
    parameters: objectSchema({
      reason: { type: 'string', description: '求助原因' },
    }, ['reason']),
  },
];

export function validateClientTool({ call, role, session }) {
  const task = currentTaskOf(role, session);
  if (call.name === 'show_navigation') {
    if (call.arguments.taskId !== task.id) throw new Error('导航工具只能使用当前任务 ID。');
    if (task.location?.mode === 'none') throw new Error('当前任务没有配置导航地点。');
    return {
      renderer: 'navigation',
      taskId: task.id,
      title: task.location?.name || role.location,
      location: task.location?.name || role.location,
      geofence: task.location?.geofence || role.geofence,
      coordinates: task.location?.coordinates || null,
      radiusMeters: task.location?.radiusMeters || null,
      verification: task.location?.verification || 'manual',
      minDwellSeconds: task.location?.minDwellSeconds || 0,
    };
  }
  if (call.name === 'open_task_tool') {
    const tool = currentToolOf(role, session);
    if (!tool || call.arguments.toolInstanceId !== tool.id) throw new Error('工具实例不属于当前任务。');
    return {
      renderer: tool.renderer,
      toolInstanceId: tool.id,
      taskId: tool.taskId,
      roleStageId: tool.roleStageId || tool.taskId,
      taskIndex: tool.taskIndex,
      title: tool.title,
      instructions: tool.instructions,
      modules: tool.modules,
      config: tool.publicConfig,
      completionMode: tool.validation?.completionMode || 'tool_result',
    };
  }
  if (call.name === 'call_teacher') {
    return { renderer: 'teacher-call', reason: call.arguments.reason };
  }
  throw new Error(`工具 ${call.name} 不能发送到学生端。`);
}
