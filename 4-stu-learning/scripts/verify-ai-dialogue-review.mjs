import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { validateHumanReview } from './ai-dialogue-review.mjs';

async function readJson(filename, label) {
  if (!filename) throw new Error(`${label}_PATH_MISSING`);
  const text = await fs.readFile(path.resolve(filename), 'utf8');
  return {
    payload: JSON.parse(text),
    sha256: crypto.createHash('sha256').update(text).digest('hex'),
  };
}

async function main() {
  const artifactFile = process.env.AI_DIALOGUE_REVIEW_ARTIFACT || '';
  const reviewFile = process.env.AI_DIALOGUE_REVIEW_RESULTS || '';
  const artifact = await readJson(artifactFile, 'AI_DIALOGUE_REVIEW_ARTIFACT');
  const review = await readJson(reviewFile, 'AI_DIALOGUE_REVIEW_RESULTS');
  const result = validateHumanReview(
    artifact.payload,
    review.payload,
    undefined,
    { artifactSha256: artifact.sha256, currentWorkspaceRoot: process.cwd() },
  );
  const outputFile = path.resolve(
    process.env.AI_DIALOGUE_REVIEW_SUMMARY
      || path.join(path.dirname(path.resolve(reviewFile)), 'review-summary.json'),
  );
  await fs.writeFile(outputFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  process.stdout.write(`${outputFile}\n`);
  if (result.passed) return;
  process.stderr.write(`HUMAN_REVIEW_GATE_FAILED: ${result.issues.map((issue) => issue.code).join(', ')}\n`);
  process.exitCode = result.complete ? 1 : 2;
}

await main().catch((error) => {
  process.stderr.write(`HUMAN_REVIEW_GATE_FATAL: ${String(error?.message || error)}\n`);
  process.exitCode = 2;
});
