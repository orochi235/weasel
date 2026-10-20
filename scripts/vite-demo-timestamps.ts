import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { PluginOption } from 'vite';

/**
 * Virtual module that exposes git-derived creation + last-modification
 * timestamps for every demo source file under `apps/site/demos/`.
 *
 *   import TIMESTAMPS from 'virtual:demo-timestamps';
 *   TIMESTAMPS['apps/site/demos/TransformDemo.tsx'] // → { created, lastModified }
 *
 * Both values are ISO-8601 author dates. `created` is the *first* commit
 * to add the file; `lastModified` is the most recent commit touching it.
 * Files not yet tracked by git are omitted.
 */
export function demoTimestamps(opts: { root?: string } = {}): PluginOption {
  const VIRTUAL_ID = 'virtual:demo-timestamps';
  const RESOLVED_ID = '\0' + VIRTUAL_ID;
  const root = opts.root ?? process.cwd();
  const demosDir = resolve(root, 'apps/site/demos');

  return {
    name: 'demo-timestamps',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      if (!existsSync(demosDir)) return 'export default {};';
      const files = walkFiles(demosDir).map((file) => relative(root, file).replace(/\\/g, '/'));
      return `export default ${JSON.stringify(timestampsFromLog(readDemoLog(root), files), null, 2)};`;
    },
    configureServer(server) {
      // Invalidate the virtual module when any demo file changes so dev
      // sessions stay current with new commits / file moves.
      server.watcher.on('change', (file) => {
        if (!file.startsWith(demosDir)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
      });
    },
  };
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * One pass over the demos' history, newest commit first. A `git log --follow` per file took 2.5 s
 * each, and the site's 277 demo files made that the cost of every test run and dev start.
 * `demo/` is where the demos lived before `apps/site/`, so renames out of it are followed.
 */
function readDemoLog(cwd: string): string {
  try {
    // `--cc` lists a merge that changed a file itself, as `git log -- <file>` counts it.
    return execSync('git log -M --cc --name-status --format=%x00%aI -- apps/site/demos demo', {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 1 << 28,
    });
  } catch {
    return '';
  }
}

/**
 * Each of `files`, dated from `log` (`git log --name-status --format=%x00%aI`, newest first):
 * `lastModified` by the newest commit naming it, `created` by the oldest add of it or of a name it
 * was renamed from. A file no commit names is left out.
 */
export function timestampsFromLog(
  log: string,
  files: string[],
): Record<string, { created: string; lastModified: string }> {
  const lastModified = new Map<string, string>();
  const created = new Map<string, string>();
  // The name each file had at the commit being read, keyed by that name.
  const followed = new Map(files.map((file) => [file, file]));
  for (const commit of log.split('\0').slice(1)) {
    const [date, ...lines] = commit.split('\n');
    for (const line of lines) {
      const [status, path, renamedTo] = line.split('\t');
      if (!status) continue;
      const name = status.startsWith('R') ? renamedTo : path;
      const file = followed.get(name);
      if (file === undefined) continue;
      if (name === file && !lastModified.has(file)) lastModified.set(file, date);
      if (status === 'A') created.set(file, date);
      if (status.startsWith('R')) {
        followed.delete(name);
        followed.set(path, file);
      }
    }
  }
  const out: Record<string, { created: string; lastModified: string }> = {};
  for (const file of files) {
    const last = lastModified.get(file);
    if (last) out[file] = { created: created.get(file) ?? last, lastModified: last };
  }
  return out;
}
