import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

for (const filename of ['.env.local', '.env']) {
  const envPath = path.join(projectRoot, filename);
  if (fs.existsSync(envPath)) config({ path: envPath, override: false });
}
