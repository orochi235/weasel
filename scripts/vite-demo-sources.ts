import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { PluginOption } from 'vite';
import { namedSpecifiers } from './lib/imports.mjs';

/**
 * Virtual modules that expose each demo's source text to the code panel
 * *without* pulling it into the entry bundle.
 *
 *   import DEMO_SOURCES from 'virtual:demo-sources';
 *   DEMO_SOURCES['apps/site/demos/SceneDemo.tsx']
 *   // → [{ path, language, load }, ...] — the demo's own TSX first, then
 *   //   a tab for each relative import that resolves to a readable file
 *   //   not marked `@site-chrome`.
 *
 * `load()` is a dynamic import of a per-file virtual module, so a demo's
 * source is a chunk of its own, fetched when the panel asks for it.
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
      // file it can reach changes.
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

const LANGUAGES: readonly string[] = ['json', 'tsx', 'ts', 'css', 'md'] satisfies Language[];

/** The panel language for a file extension, or `undefined` for a file the panel cannot show. */
function extToLang(ext: string): Language | undefined {
  return LANGUAGES.includes(ext) ? (ext as Language) : undefined;
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

/** Marks a file as the site's own furniture, left out of every code panel:
 *  `@site-chrome` opening a comment line, as in a `/** @site-chrome *\/` header. */
const SITE_CHROME = /^\s*(?:\/\/|\/\*\*?|\*)\s*@site-chrome\b/m;

function isSiteChrome(root: string, path: string): boolean {
  return SITE_CHROME.test(readFileSync(resolve(root, path), 'utf8'));
}

/** A demo's files as its code panel lists them: the demo itself, then each
 *  file it imports by relative path, except one marked site chrome. */
export function tabsFor(root: string, demoPath: string): { path: string; language: Language }[] {
  const src = readFileSync(resolve(root, demoPath), 'utf8');
  const tabs: { path: string; language: Language }[] = [
    { path: demoPath, language: 'tsx' },
  ];
  const seen = new Set([demoPath]);
  for (const specifier of namedSpecifiers(src, demoPath)) {
    if (!/^[./]/.test(specifier)) continue;
    const resolved = resolveRelative(demoPath, specifier);
    if (seen.has(resolved)) continue;
    const found = findFile(root, resolved);
    const language = found && extToLang(found.ext);
    if (!found || !language || seen.has(found.path)) continue;
    seen.add(found.path);
    if (isSiteChrome(root, found.path)) continue;
    tabs.push({ path: found.path, language });
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
