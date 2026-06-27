import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { PluginOption } from 'vite';

/**
 * Virtual module that exposes git-derived creation + last-modification
 * timestamps for every demo source file under `apps/site/demos/`. The demo
 * registry imports it and joins per-entry by `path`, so the demo header
 * can show "last modified" without anyone hand-curating dates.
 *
 *   import TIMESTAMPS from 'virtual:demo-timestamps';
 *   TIMESTAMPS['apps/site/demos/TransformDemo.tsx'] // → { created, lastModified }
 *
 * Both values are ISO-8601 author dates. `created` is the *first* commit
 * to add the file; `lastModified` is the most recent commit touching it.
 * Files not yet tracked by git are omitted (the consumer treats missing
 * entries as "unknown").
 *
 * Computed once at module load. In dev the plugin re-runs whenever any
 * file under `apps/site/demos/` changes, so saves don't require a server
 * restart to update the dates.
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
      const out: Record<string, { created: string; lastModified: string }> = {};
      if (!existsSync(demosDir)) {
        return `export default ${JSON.stringify(out)};`;
      }
      for (const file of walkFiles(demosDir)) {
        const rel = relative(root, file).replace(/\\/g, '/');
        const ts = readGitTimestamps(rel, root);
        if (ts) out[rel] = ts;
      }
      return `export default ${JSON.stringify(out, null, 2)};`;
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

function readGitTimestamps(
  relPath: string,
  cwd: string,
): { created: string; lastModified: string } | null {
  try {
    const lastModified = run(`git log -1 --format=%aI -- "${relPath}"`, cwd);
    if (!lastModified) return null;
    // First add-commit. `--diff-filter=A` returns rename-skipping creation;
    // `--follow` survives renames at the cost of one extra pass.
    const addedLog = run(`git log --diff-filter=A --follow --format=%aI -- "${relPath}"`, cwd);
    const created = addedLog.split('\n').filter(Boolean).pop() ?? lastModified;
    return { created, lastModified };
  } catch {
    return null;
  }
}

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}
