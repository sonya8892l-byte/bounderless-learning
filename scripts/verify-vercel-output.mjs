import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const functionsRoot = path.join(repositoryRoot, '.vercel', 'output', 'functions');
const staticRoot = path.join(repositoryRoot, '.vercel', 'output', 'static');

async function collect(directory, result = []) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(fullPath, result);
    } else {
      const stat = await fs.stat(fullPath);
      result.push({
        path: path.relative(directory, fullPath).replaceAll('\\', '/'),
        fullPath,
        size: stat.size,
      });
    }
  }
  return result;
}

async function functionDirectories(directory) {
  const result = [];
  async function visit(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.name.endsWith('.func')) {
        result.push(fullPath);
      } else {
        await visit(fullPath);
      }
    }
  }
  await visit(directory);
  return result;
}

function fail(message) {
  throw new Error(`Vercel Function 产物校验失败：${message}`);
}

try {
  await fs.access(functionsRoot);
} catch {
  fail('找不到 .vercel/output/functions；请先运行 npm run vercel:build。');
}
try {
  await fs.access(staticRoot);
} catch {
  fail('找不到 .vercel/output/static；请先运行 npm run vercel:build。');
}

const functions = await functionDirectories(functionsRoot);
if (functions.length !== 1) {
  fail(`预期只有 1 个 API Function，实际为 ${functions.length} 个。`);
}

const functionRoot = functions[0];
const files = await collect(functionRoot);
const relativeFiles = files.map((entry) => (
  path.relative(functionRoot, entry.fullPath).replaceAll('\\', '/')
));
const requiredRuntimeFiles = [
  'api/serverless.mjs',
  'server/vercel/serverless-handler.mjs',
  '4-stu-learning/server/app.js',
  '4-stu-learning/server/config/env.js',
  '4-stu-learning/package.json',
  '4-stu-learning/src/engine/lesson-parser.js',
  '4-stu-learning/src/engine/platform-config.js',
  '4-stu-learning/src/engine/tool-registry.js',
];
for (const required of requiredRuntimeFiles) {
  if (!relativeFiles.some((filename) => filename.endsWith(required))) {
    fail(`Function 中缺少运行时文件 ${required}。`);
  }
}
try {
  const entryModule = await import(
    `${pathToFileURL(path.join(functionRoot, 'api', 'serverless.mjs')).href}?verify=${Date.now()}`
  );
  if (typeof entryModule.default !== 'function') {
    fail('Function 入口没有导出默认处理函数。');
  }
} catch (error) {
  fail(`Function 入口无法加载（${error?.code || error?.name || 'unknown'}）。`);
}
const lessonEntries = await fs.readdir(path.join(repositoryRoot, '6-lessons'), {
  withFileTypes: true,
});
const requiredCourseFiles = lessonEntries
  .filter((entry) => entry.isDirectory() && /^lesson_[a-zA-Z0-9_-]+$/.test(entry.name))
  .map((entry) => `6-lessons/${entry.name}/course.md`)
  .sort();
if (!requiredCourseFiles.length) fail('源码中没有找到任何课程 course.md。');
const requiredPlatformFiles = [
  '6-lessons/_platform/safety-rules.md',
  '6-lessons/_platform/pedagogy-rules.md',
  '6-lessons/_platform/privacy-rules.md',
];

for (const required of [...requiredPlatformFiles, ...requiredCourseFiles]) {
  try {
    await fs.access(path.join(repositoryRoot, required));
  } catch {
    fail(`源码课程目录缺少 ${required}。`);
  }
  if (!relativeFiles.some((filename) => filename.endsWith(required))) {
    fail(`Function 中缺少 ${required}。`);
  }
}

const prohibitedPath = /^(?:dist|4-tea-leading|0-temp-asset|_temp_ref|supabase|4-stu-learning\/(?:dist|public|tests|screenshots|uploads|test-artifacts|\.runtime|docs|scripts))(?:\/|$)/;
const prohibitedFrontendSource = /^4-stu-learning\/src\/(?!engine\/)/;
const prohibitedExtension = /\.(?:html|css|png|jpe?g|gif|webp|svg|webm|mp4|mov|mp3|wav|m4a)$/i;
const prohibitedFiles = relativeFiles.filter((filename) => (
  prohibitedPath.test(filename)
  || prohibitedFrontendSource.test(filename)
  || prohibitedExtension.test(filename)
  || /(?:^|\/)\.env(?:\.|$)/.test(filename)
));
if (prohibitedFiles.length) {
  fail(`Function 混入非服务端资源：${prohibitedFiles.slice(0, 8).join(', ')}`);
}

const totalBytes = files.reduce((sum, entry) => sum + entry.size, 0);
if (totalBytes > 100 * 1024 * 1024) {
  fail(`Function 解包体积为 ${(totalBytes / 1024 / 1024).toFixed(1)} MB，超过本项目 100 MB 门禁。`);
}

const staticFiles = await collect(staticRoot);
const redactedFrontendFiles = [];
for (const entry of staticFiles) {
  if (!/^student\/assets\/.*\.js$/i.test(entry.path)) continue;
  const content = await fs.readFile(entry.fullPath, 'utf8');
  // 课程公开包会故意用 [SENSITIVE] 隐藏未解锁答案；这里只检查客户端启动代码前缀，
  // 防止 Vercel env pull 的脱敏值被编译成 API 基地址。
  if (content.slice(0, 16 * 1024).includes('[SENSITIVE]')) {
    redactedFrontendFiles.push(entry.path);
  }
}
if (redactedFrontendFiles.length) {
  fail(`前端 API 启动代码混入 Vercel 脱敏占位符：[${redactedFrontendFiles.slice(0, 8).join(', ')}]`);
}

console.log(JSON.stringify({
  ok: true,
  function: path.relative(repositoryRoot, functionRoot).replaceAll('\\', '/'),
  files: files.length,
  sizeMB: Number((totalBytes / 1024 / 1024).toFixed(2)),
  staticFiles: staticFiles.length,
  requiredCourses: requiredCourseFiles,
}, null, 2));
