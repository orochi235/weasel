// `npm run release`: `changeset publish`, with scripts/npm-shim first on PATH
// so a publish retried inside npm's staging window is not read as a failure.
// See scripts/lib/npm-shim.mjs.
import { spawn } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';
import { repoRoot } from './lib/workspaces.mjs';

// The shim is handed an absolute npm so it can never find itself on PATH.
// `npm run` sets npm_execpath to the CLI that launched it; otherwise take the
// first `npm` on PATH as it stands before the shim goes in front.
function findRealNpm() {
  const execpath = process.env.npm_execpath;
  if (execpath && /\.c?js$/.test(execpath)) return [process.execPath, execpath];
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    try {
      accessSync(join(dir, 'npm'), constants.X_OK);
      return [join(dir, 'npm')];
    } catch {}
  }
  throw new Error('release: no npm on PATH');
}
const realNpm = findRealNpm();

const child = spawn('changeset', ['publish', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PATH: [join(repoRoot, 'scripts', 'npm-shim'), process.env.PATH].join(delimiter),
    WEASEL_REAL_NPM: JSON.stringify(realNpm),
  },
});
child.on('error', (e) => {
  console.error(e);
  process.exit(1);
});
child.on('close', (code) => process.exit(code ?? 1));
