import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLesson } from '../src/engine/lesson-parser.js';
import { loadPlatformDefaults } from '../server/course/platform-defaults.js';
import { toPublic } from '../server/course/projections.js';
import {
  materializeCourseDocuments,
  runtimeCourseFiles,
} from '../src/engine/course-documents.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lessonsRoot = resolve(projectRoot, '../6-lessons');
const publicLessonsRoot = resolve(projectRoot, 'public/lessons');
const generatedFile = resolve(projectRoot, 'src/generated/lesson-public.js');

async function collectMarkdown(directory, base = directory, result = {}) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await collectMarkdown(fullPath, base, result);
    } else if (extname(entry.name) === '.md') {
      const key = relative(base, fullPath).replaceAll('\\', '/');
      result[key] = await readFile(fullPath, 'utf8');
    }
  }

  return result;
}

const lessonIds = (await readdir(lessonsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .map((entry) => entry.name)
  .sort();

// 清理已删课程的过期产物：课程从 6-lessons 删除后，public/lessons 下的旧目录
// 不会自动消失，会被打进部署产物。
const staleDirectories = (await readdir(publicLessonsRoot, { withFileTypes: true }).catch(() => []))
  .filter((entry) => entry.isDirectory() && !lessonIds.includes(entry.name))
  .map((entry) => entry.name);
for (const name of staleDirectories) {
  await rm(resolve(publicLessonsRoot, name), { recursive: true, force: true });
}
if (staleDirectories.length) {
  console.log(`已清理 ${staleDirectories.length} 个过期课程产物：${staleDirectories.join(', ')}`);
}

// 公开包与服务端课程包读同一份平台缺省层，避免两条编译链各自持有一套数值缺省。
const platformDefaults = await loadPlatformDefaults({ lessonsRoot });

const publicLessons = {};

for (const lessonId of lessonIds) {
  const sourceDirectory = resolve(lessonsRoot, lessonId);
  const publicDirectory = resolve(publicLessonsRoot, lessonId);
  const assetDirectory = resolve(sourceDirectory, 'assets');

  await rm(publicDirectory, { recursive: true, force: true });
  await mkdir(publicDirectory, { recursive: true });
  const publicAssetDirectory = resolve(publicDirectory, 'assets');
  try {
    await cp(assetDirectory, publicAssetDirectory, {
      recursive: true,
      force: true,
    });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await mkdir(publicAssetDirectory, { recursive: true });
  }

  const source = {
    id: lessonId,
    files: materializeCourseDocuments(runtimeCourseFiles(await collectMarkdown(sourceDirectory))),
    assetBase: `lessons/${lessonId}/assets`,
  };
  const lesson = parseLesson(source, {
    platformDefaults,
    onWarning: (warning) => console.warn(`[${lessonId}] ${warning.message}`),
  });

  // 浏览器只接收渲染所需的公开字段。真值、知识、限制和答案留在服务端课程包。
  // 裁剪与脱敏的唯一实现在 server/course/projections.js，服务端共用同一份。
  publicLessons[lessonId] = toPublic(lesson, source.files['restrictions.md']);
}

await mkdir(dirname(generatedFile), { recursive: true });
await writeFile(
  generatedFile,
  `// 此文件由 scripts/sync-lessons.mjs 自动生成，只包含学生端公开课程字段。\nexport default ${JSON.stringify(publicLessons, null, 2)};\n`,
  'utf8',
);

console.log(`已同步 ${lessonIds.length} 门课程：${lessonIds.join(', ')}`);
