/**
 * Dev/build Vite plugin serving where each export of the kit's packages and of
 * draw itself is declared:
 *
 *   import index from 'virtual:weasel-source-index';
 *
 * The Bundle Inspector's "source" rows and JSDoc read it. It holds one
 * `{ path, line, jsdoc }` per export, not the files, so the inspector's chunk
 * carries a few MB rather than every package's source.
 */
import type { Plugin } from 'vite';
import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { packageSourceDirs } from './vite-plugin-callback-source.ts';
import { indexExports } from './vite-plugin-source-index/exportInfo.ts';
import type { SourceIndex } from './src/dev/sourceIndex.types.ts';

const VIRTUAL_ID = 'virtual:weasel-source-index';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/** The directories the index reads: every package's `src`, and draw's. */
export function sourceIndexDirs(repoRoot: string): readonly string[] {
  return [...packageSourceDirs(repoRoot), resolve(repoRoot, 'apps/draw/src')];
}

/** Whether `file` is source the index reads: TypeScript, and not a test, story or declaration file. */
export function isIndexedSource(file: string): boolean {
  return /\.tsx?$/.test(file) && !/\.(test|spec|stories)\.tsx?$/.test(file) && !file.endsWith('.d.ts')
    && !file.split(sep).includes('__tests__');
}

function collect(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '__tests__') collect(path, out);
    } else if (isIndexedSource(path)) out.push(path);
  }
}

/** Index every export under {@link sourceIndexDirs}, keyed by name, each path
 *  repo-relative with a leading slash (`/packages/core/src/…`). */
export function buildSourceIndex(repoRoot: string): SourceIndex {
  const files: string[] = [];
  for (const dir of sourceIndexDirs(repoRoot)) collect(dir, files);
  const sources: Record<string, string> = {};
  for (const file of files) sources[`/${relative(repoRoot, file).split(sep).join('/')}`] = readFileSync(file, 'utf8');
  return indexExports(sources);
}

export function sourceIndexPlugin({ repoRoot }: { readonly repoRoot: string }): Plugin {
  let cached: SourceIndex | null = null;
  return {
    name: 'weasel:source-index',
    configureServer(server) {
      const dirs = sourceIndexDirs(repoRoot);
      const refresh = (file: string) => {
        const abs = resolve(file);
        if (!isIndexedSource(abs) || !dirs.some((d) => abs.startsWith(d + sep))) return;
        cached = null;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
      };
      for (const event of ['change', 'add', 'unlink'] as const) server.watcher.on(event, refresh);
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      cached ??= buildSourceIndex(repoRoot);
      return `export default ${JSON.stringify(cached)};\n`;
    },
  };
}
