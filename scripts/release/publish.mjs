// `npm run release`: `changeset publish`, with scripts/npm-shim first on PATH
// so a publish retried inside npm's staging window is not read as a failure.
// See scripts/lib/npm-shim.mjs.
import { spawn } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';
import { cli } from '../lib/help.mjs';
import { repoRoot } from '../lib/workspaces.mjs';

// `changeset publish`'s own flags (@changesets/cli 3), declared rather than passed through so a
// mistyped one stops here instead of reaching a real publish that ignores it.
const PUBLISH_FLAGS = {
  tag: { type: 'string', placeholder: '<name>', description: 'publish under this npm dist-tag' },
  otp: { type: 'string', placeholder: '<code>', description: 'one-time password for npm publish' },
  'from-pack-dir': { type: 'string', placeholder: '<dir>', description: 'publish from a packed output directory' },
  'no-git-tag': { type: 'boolean', description: 'create no git tag for the release' },
};
const { values } = cli(import.meta.url, {
  summary:
    "Publishes every package with a new version to npm: `changeset publish`, with scripts/npm-shim first on PATH so a publish retried inside npm's staging window is not read as a failure.",
  options: PUBLISH_FLAGS,
  notes: 'Each option is handed to `changeset publish` as given.',
});
const forwarded = Object.entries(values).flatMap(([name, value]) =>
  value === true ? [`--${name}`] : typeof value === 'string' ? [`--${name}`, value] : [],
);

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

const child = spawn('changeset', ['publish', ...forwarded], {
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
