import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreDir = path.resolve(__dirname, '..');

// 1. Generate TS 7 declarations using tsc
console.log('Generating TS 7 declarations...');
execSync('tsc -p tsconfig.build.json', { cwd: coreDir, stdio: 'inherit' });

// 2. Generate TS 5 declarations in dist/ts5
console.log('Generating TS 5 declarations...');
const ts7Dir = path.join(coreDir, 'dist', 'ts7');
const ts5Dir = path.join(coreDir, 'dist', 'ts5');

if (fs.existsSync(ts5Dir)) {
  fs.rmSync(ts5Dir, { recursive: true, force: true });
}

fs.cpSync(ts7Dir, ts5Dir, { recursive: true });

// 3. Create fallback declaration root re-exports
fs.writeFileSync(path.join(coreDir, 'dist', 'index.d.ts'), "export * from './ts7/index.js';\n");
fs.writeFileSync(path.join(coreDir, 'dist', 'index.frontend.d.ts'), "export * from './ts7/index.frontend.js';\n");

console.log('Type declarations generated successfully for TS 7 and TS 5.');
