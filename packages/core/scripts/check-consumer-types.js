import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const coreDir = fileURLToPath(new URL('..', import.meta.url));
execFileSync(process.execPath, [path.join(coreDir, 'scripts/build-types.js')], {
  cwd: coreDir,
  stdio: 'inherit',
});

// The package test configuration is non-strict. Check its public declarations as
// a strict consumer too, without imposing strict mode on unrelated source files.
const temporaryDir = mkdtempSync(path.join(coreDir, 'test/.consumer-types-'));
try {
  const fixtures = [
    'type-review.types.ts',
    'populate-options-array.types.ts',
    'strict-model.types.ts',
  ].map((name) => {
    const source = readFileSync(path.join(coreDir, 'test', name), 'utf8');
    const target = path.join(temporaryDir, name);
    writeFileSync(target, source.replaceAll('../src/index.js', '../../dist/ts7/index.js'));
    return target;
  });
  execFileSync(
    'tsc',
    [
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--target',
      'esnext',
      '--module',
      'nodenext',
      '--esModuleInterop',
      '--noUncheckedIndexedAccess',
      '--noErrorTruncation',
      'false',
      ...fixtures,
    ],
    {cwd: coreDir, stdio: 'inherit'},
  );
} finally {
  rmSync(temporaryDir, {recursive: true, force: true});
}
