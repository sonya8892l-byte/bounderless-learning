import './config/load-local-env.js';
import { loadEnv } from './config/env.js';
import { buildApp } from './app.js';

const env = loadEnv();
// 进程启动时重新加载并编译课程配置。
const app = await buildApp({
  env,
  serveStatic: true,
  realtimeMode: env.REALTIME_MODE === 'websocket' ? 'websocket' : 'polling',
});

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}

let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await app.close();
}

process.once('SIGINT', close);
process.once('SIGTERM', close);
