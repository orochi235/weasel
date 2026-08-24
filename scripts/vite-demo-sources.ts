import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { PluginOption } from 'vite';

/**
 * Virtual modules that expose each demo's source text to the code panel
 * *without* pulling it into the entry bundle.
 *
 *   import DEMO_SOURCES from 'virtual:demo-sources';
 *   DEMO_SOURCES['apps/site/demos/SceneDemo.tsx']
 *   // → [{ path, language, load }, ...] — the demo's own TSX first, then
 *   //   a tab for each relative import that resolves to a readable file.
 *
 * `load()` is a dynamic import of a per-file virtual module, so a demo's
 * source is a chunk of its own, fetched when the panel asks for it.
 *
 * Resolving the companion tabs here rather than in the browser is the point:
 * the previous registry did it at module load with an eager `import.meta.glob`
 * over `packages/ ** /src`, which inlined ~1,880 files to produce 11 tabs.
 */
export function demoSources(opts: { root?: string } = {}): PluginOption {
  const INDEX_ID = 'virtual:demo-sources';
  const RESOLVED_INDEX = '\0' + INDEX_ID;
  /** Per-file source module: `virtual:demo-source:<repo-relative path>.js`.
   *  The `.js` is load-bearing — without it vite's css/json/jsx transforms
   *  match on the trailing real extension and try to compile these JS
   *  modules as the file they quote. */
  const FILE_PREFIX = 'virtual:demo-source:';
  const FILE_SUFFIX = '.js';
  const RESOLVED_FILE_PREFIX = '\0' + FILE_PREFIX;

  const root = opts.root ?? process.cwd();
  const demosDir = resolve(root, 'apps/site/demos');

  return {
    name: 'demo-sources',
    resolveId(id) {
      if (id === INDEX_ID) return RESOLVED_INDEX;
      if (id.startsWith(FILE_PREFIX)) return '\0' + id;
      return null;
    },
    load(id) {
      if (id === RESOLVED_INDEX) return renderIndex(demosDir, root, FILE_PREFIX, FILE_SUFFIX);
      if (id.startsWith(RESOLVED_FILE_PREFIX)) {
        const rel = id.slice(RESOLVED_FILE_PREFIX.length, -FILE_SUFFIX.length);
        const file = resolve(root, rel);
        if (!existsSync(file)) return `export default '';`;
        return `export default ${JSON.stringify(readFileSync(file, 'utf8'))};`;
      }
      return null;
    },
    configureServer(server) {
      // A demo's own text and its derived tab list both go stale when any
      // file it can reach changes, so invalidate the index plus that file's
      // source module. Which demos cite a given file is exactly what the
      // index computes, so drop the index and let it recompute.
      server.watcher.on('change', (file) => {
        const rel = relative(root, file).replace(/\\/g, '/');
        for (const modId of [RESOLVED_INDEX, RESOLVED_FILE_PREFIX + rel + FILE_SUFFIX]) {
          const mod = server.moduleGraph.getModuleById(modId);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
      });
    },
  };
}

type Language = 'json' | 'tsx' | 'ts' | 'css' | 'md';

function extToLang(ext: string): Language {
  if (ext === 'json') return 'json';
  if (ext === 'ts') return 'ts';
  if (ext === 'css') return 'css';
  if (ext === 'md') return 'md';
  return 'tsx';
}

/** Resolve `./data/x.json` cited from `apps/site/demos/D.tsx` to
 *  `apps/site/demos/data/x.json`. */
function resolveRelative(fromPath: string, importPath: string): string {
  const dir = fromPath.substring(0, fromPath.lastIndexOf('/'));
  const stack: string[] = [];
  for (const part of (dir + '/' + importPath).split('/')) {
    if (part === '..') stack.pop();
    else if (part && part !== '.') stack.push(part);
  }
  return stack.join('/');
}

/** Apply the extension/index resolution a bundler would, so an import of
 *  `../platformer/physics` finds `physics.ts`. */
function findFile(root: string, resolved: string): { path: string; ext: string } | null {
  const candidates = /\.[a-z]+$/.test(resolved)
    ? [resolved]
    : [`${resolved}.tsx`, `${resolved}.ts`, `${resolved}.json`, `${resolved}.css`,
       `${resolved}/index.tsx`, `${resolved}/index.ts`];
  for (const c of candidates) {
    if (existsSync(resolve(root, c))) {
      return { path: c, ext: c.match(/\.([a-z]+)$/)?.[1] ?? 'tsx' };
    }
  }
  return null;
}

const RELATIVE_IMPORT_RE = /from\s+['"]([./][^'"]+)['"]/g;

function tabsFor(root: string, demoPath: string): { path: string; language: Language }[] {
  const src = readFileSync(resolve(root, demoPath), 'utf8');
  const tabs: { path: string; language: Language }[] = [
    { path: demoPath, language: 'tsx' },
  ];
  const seen = new Set([demoPath]);
  for (const m of src.matchAll(RELATIVE_IMPORT_RE)) {
    const resolved = resolveRelative(demoPath, m[1]);
    if (seen.has(resolved)) continue;
    const found = findFile(root, resolved);
    if (!found || seen.has(found.path)) continue;
    seen.add(found.path);
    tabs.push({ path: found.path, language: extToLang(found.ext) });
  }
  return tabs;
}

function renderIndex(
  demosDir: string, root: string, filePrefix: string, fileSuffix: string,
): string {
  const entries: string[] = [];
  for (const file of readdirSync(demosDir)) {
    if (!file.endsWith('.tsx')) continue;
    const demoPath = relative(root, resolve(demosDir, file)).replace(/\\/g, '/');
    const tabs = tabsFor(root, demoPath).map((t) => (
      `    { path: ${JSON.stringify(t.path)}, language: ${JSON.stringify(t.language)},`
      + ` load: () => import(${JSON.stringify(filePrefix + t.path + fileSuffix)}).then((m) => m.default) }`
    ));
    entries.push(`  ${JSON.stringify(demoPath)}: [\n${tabs.join(',\n')},\n  ]`);
  }
  return `export default {\n${entries.join(',\n')},\n};\n`;
}
