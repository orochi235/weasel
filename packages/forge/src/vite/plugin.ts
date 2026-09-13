import { globSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin, ViteDevServer } from 'vite';
import type { IndexEntry } from '../story/types';
import { html } from './html';
import { indexFile } from './indexFile';

export interface ForgeOptions {
  /** Globs of story files, relative to the vite root. */
  stories: string[];
  /** Path to forge.config (frame + shell halves), relative to the vite root. Optional. */
  config?: string;
  /** Alias Storybook's runtime modules to forge shims (Task 13). Default true. */
  storybookShims?: boolean;
}

const PREFIX = 'virtual:forge/';
const MODULES = new Set(['index.js', 'importers.js', 'config.js', 'shell-entry.js', 'frame-entry.js']);
const PAGES: Record<string, string> = { '/': 'shell-entry.js', '/index.html': 'shell-entry.js', '/frame.html': 'frame-entry.js' };

export function forge(options: ForgeOptions): Plugin[] {
  let root = process.cwd();
  let base = '/';
  let byFile: Map<string, IndexEntry[]> | null = null;

  const glob = (): string[] => {
    const files = options.stories.flatMap((pattern) =>
      globSync(pattern, { cwd: root, exclude: (name) => basename(String(name)) === 'node_modules' })
        .map((f) => resolve(root, f))
        .sort(),
    );
    return [...new Set(files)];
  };
  const read = (file: string) => indexFile(readFileSync(file, 'utf8'), file, root);
  const files = (): Map<string, IndexEntry[]> => {
    byFile ??= new Map(glob().map((file) => [file, read(file)]));
    return byFile;
  };
  const index = () => [...files().values()].flat();

  const modules: Record<string, () => string> = {
    'index.js': () => `export default ${JSON.stringify(index())};\n`,
    'importers.js': () => {
      const lines = [...files()]
        .filter(([, entries]) => entries.length > 0)
        .map(([file]) => `  ${JSON.stringify(file)}: () => import(${JSON.stringify(file)}),`);
      return `export default {\n${lines.join('\n')}\n};\n`;
    },
    'config.js': () =>
      options.config
        ? `export { default } from ${JSON.stringify(resolve(root, options.config))};\n`
        : 'export default {};\n',
    'shell-entry.js': () => `import { mountWorkshop } from '@weasel-js/forge/shell';
import '@weasel-js/forge/shell.css';
import index from 'virtual:forge/index.js';
import config from 'virtual:forge/config.js';

const workshop = mountWorkshop({ root: document.getElementById('root'), index, config, frameUrl: 'frame.html' });
import.meta.hot?.on('forge:index', (next) => workshop.setIndex(next));
`,
    'frame-entry.js': () => `import { loadNativeModule, mountFrame } from '@weasel-js/forge/frame';
import index from 'virtual:forge/index.js';
import importers from 'virtual:forge/importers.js';
import config from 'virtual:forge/config.js';

mountFrame({
  index,
  importers,
  root: document.getElementById('root'),
  setup: config.frame,
  load: (mod, file) => loadNativeModule(mod, file, ${JSON.stringify(root)}),
});
`,
  };

  function reindex(server: ViteDevServer, file: string, event: 'add' | 'change' | 'unlink'): void {
    const current = files();
    if (event === 'change' && !current.has(file)) return;
    if (event === 'add' && !glob().includes(file)) return;
    if (event === 'unlink' && !current.has(file)) return;

    const before = JSON.stringify(index());
    if (event === 'unlink') {
      current.delete(file);
    } else {
      try {
        current.set(file, read(file));
      } catch (err) {
        server.config.logger.error(`[forge] ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
    }
    const next = index();
    if (JSON.stringify(next) === before) return;

    for (const env of Object.values(server.environments)) {
      for (const name of ['index.js', 'importers.js']) {
        const mod = env.moduleGraph.getModuleById(`\0${PREFIX}${name}`);
        if (mod) env.moduleGraph.invalidateModule(mod);
      }
    }
    server.ws.send({ type: 'custom', event: 'forge:index', data: next });
  }

  return [
    {
      name: 'weaselforge',
      config() {
        if (options.storybookShims === false) return undefined;
        const previewApi = resolve(dirname(fileURLToPath(import.meta.url)), '../csf/shims/preview-api.ts');
        return { resolve: { alias: [{ find: /^@?storybook\/preview-api$/, replacement: previewApi }] } };
      },
      configResolved(config) {
        root = config.root;
        base = config.base;
        byFile = null;
      },
      resolveId(id) {
        return id.startsWith(PREFIX) && MODULES.has(id.slice(PREFIX.length)) ? `\0${id}` : undefined;
      },
      load(id) {
        if (!id.startsWith(`\0${PREFIX}`)) return undefined;
        return modules[id.slice(PREFIX.length + 1)]?.();
      },
      configureServer(server) {
        server.watcher.add([...files().keys()]);
        for (const event of ['add', 'change', 'unlink'] as const) {
          server.watcher.on(event, (file) => reindex(server, resolve(file), event));
        }
        server.middlewares.use((req, res, next) => {
          const url = req.url ?? '/';
          const path = url.split('?')[0] ?? '/';
          const entry = req.method === 'GET' && path.startsWith(base) ? PAGES[`/${path.slice(base.length)}`] : undefined;
          if (!entry) return next();
          server.transformIndexHtml(url, html(entry)).then(
            (doc) => {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/html');
              res.end(doc);
            },
            (err: unknown) => next(err),
          );
        });
      },
    },
  ];
}
