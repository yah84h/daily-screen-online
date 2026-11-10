import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
for (const name of ['.env', '.env.local']) {
  const file = path.join(root, name);
  if (fs.existsSync(file)) process.loadEnvFile(file);
}
await import('./server.mjs');
