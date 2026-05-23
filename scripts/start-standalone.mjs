import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const staticSource = join(root, '.next', 'static');
const staticTarget = join(root, '.next', 'standalone', '.next', 'static');
const serverPath = join(root, '.next', 'standalone', 'server.js');

if (!existsSync(serverPath)) {
  console.error('Standalone server not found. Run `npm run build` first.');
  process.exit(1);
}

if (existsSync(staticSource)) {
  mkdirSync(staticTarget, { recursive: true });
  cpSync(staticSource, staticTarget, { recursive: true, force: true });
}

const child = spawn(process.execPath, [serverPath], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
