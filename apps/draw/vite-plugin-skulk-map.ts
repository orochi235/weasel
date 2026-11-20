/**
 * Dev-server Vite plugin serving the audit page's data at `<base>__skulk/map`: the JSON `buildMap(repoRoot)`
 * in `scripts/skulk/map.mjs` returns; and one area's defects at `<base>__skulk/area?id=<area>`, from
 * `scripts/skulk/defects.mjs`. It runs that script in a child process, since building the map asks
 * `onto jobs` and may wait seconds on it, and the server must keep answering meanwhile; requests that
 * arrive while one build runs share it.
 */
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { SKULK_AREA_PATH, SKULK_MAP_PATH } from './src/dev/audits/skulkMapRoute.ts';

/** Builds the map JSON for `repoRoot`, one build at a time; a call during a build gets that build's answer. */
export function createMapBuilder(repoRoot: string, run = runMapScript): () => Promise<string> {
  let pending: Promise<string> | null = null;
  return () => {
    pending ??= run(repoRoot).finally(() => {
      pending = null;
    });
    return pending;
  };
}

const runMapScript = (repoRoot: string) => runScript(repoRoot, 'scripts/skulk/map.mjs', []);

function runScript(repoRoot: string, path: string, args: readonly string[]): Promise<string> {
  const script = resolve(repoRoot, path);
  return new Promise((done, fail) => {
    execFile(process.execPath, [script, ...args], { cwd: repoRoot, env: { ...process.env, WEASEL_ROOT: repoRoot }, maxBuffer: 32 * 1024 * 1024, timeout: 60_000 },
      (error, stdout, stderr) => (error ? fail(new Error(stderr.trim() || error.message)) : done(stdout)));
  });
}

export function skulkMapPlugin({ repoRoot }: { readonly repoRoot: string }): Plugin {
  return {
    name: 'weasel:skulk-map',
    apply: 'serve',
    configureServer(server) {
      const build = createMapBuilder(repoRoot);
      server.middlewares.use((req, res, next) => {
        const [path, query = ''] = (req.url ?? '').split('?') as [string, string?];
        const area = path.endsWith(`/${SKULK_AREA_PATH}`) ? new URLSearchParams(query).get('id') : null;
        if (!path.endsWith(`/${SKULK_MAP_PATH}`) && area === null) return next();
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end('GET only');
          return;
        }
        (area === null ? build() : runScript(repoRoot, 'scripts/skulk/defects.mjs', [area])).then((json) => {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(json);
        }, (e: Error) => {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain');
          res.end(e.message);
        });
      });
    },
  };
}
