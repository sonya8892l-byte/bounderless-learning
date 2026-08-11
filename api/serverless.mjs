import path from 'node:path';
import { buildApp } from '../4-stu-learning/server/app.js';
import { loadEnv } from '../4-stu-learning/server/config/env.js';
import { createServerlessHandler } from '../server/vercel/serverless-handler.mjs';

const repositoryRoot = process.cwd();

export default createServerlessHandler({
  buildApp,
  loadEnv: () => loadEnv({
    projectRoot: path.join(repositoryRoot, '4-stu-learning'),
    lessonsRoot: path.join(repositoryRoot, '6-lessons'),
  }),
});
