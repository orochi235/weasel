/**
 * `@weasel-js/node-render` built from source, for the browser project's `renderInNode` command:
 * the published package runs from `dist`, built from its siblings' `dist`, and a test should
 * exercise the tree it is testing. Same entries, same bundle formats.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build, type BuildOptions, type Plugin } from 'esbuild';
import { weaselAliases } from './vite-aliases.ts';
import { weaselIcons } from '../packages/icons-plugin/src/index.ts';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = resolve(ROOT, 'packages/node-render/src');
// One file, overwritten by each load: inside the repo so the bundle's bare `playwright-core`
// resolves from its node_modules.
const HOST_OUT = resolve(ROOT, 'node_modules/.cache/node-render/host.mjs');

function aliases(): Plugin {
  const table = weaselAliases(ROOT).filter((a): a is { find: RegExp; replacement: string } => a.find instanceof RegExp);
  return {
    name: 'weasel-aliases',
    setup(b) {
      b.onResolve({ filter: /^[^./]/ }, async (args) => {
        for (const { find, replacement } of table) {
          if (!find.test(args.path)) continue;
          const hit = await b.resolve(args.path.replace(find, replacement), {
            kind: args.kind, resolveDir: args.resolveDir, importer: args.importer,
          });
          return hit.errors.length ? { errors: hit.errors } : { path: hit.path };
        }
        return undefined;
      });
    },
  };
}

async function bundle(entry: string, options: BuildOptions): Promise<string> {
  const result = await build({
    entryPoints: [resolve(SRC, entry)],
    bundle: true,
    write: false,
    target: 'es2022',
    logLevel: 'silent',
    loader: { '.css': 'empty', '.less': 'empty' },
    plugins: [aliases(), weaselIcons.esbuild({ mode: 'library' })],
    ...options,
  });
  const js = result.outputFiles?.find((f) => f.path.endsWith('.js') || f.path.endsWith('.mjs'));
  if (!js) throw new Error(`node-render from source: esbuild wrote nothing for ${entry}`);
  return js.text;
}

let page: Promise<string> | undefined;
let host: Promise<typeof import('../packages/node-render/src/index.ts')> | undefined;

/** The page script, as `dist/page.global.js` holds it. */
export function nodeRenderPageScript(): Promise<string> {
  page ??= bundle('page.ts', { format: 'iife', platform: 'browser', outfile: 'page.global.js' });
  return page;
}

/** The package's main entry, loaded in this process. */
export function nodeRenderHost(): Promise<typeof import('../packages/node-render/src/index.ts')> {
  host ??= bundle('index.ts', {
    format: 'esm', platform: 'node', outfile: 'host.mjs', external: ['playwright-core'],
  }).then((text) => {
    mkdirSync(resolve(HOST_OUT, '..'), { recursive: true });
    writeFileSync(HOST_OUT, text);
    return import(`${pathToFileURL(HOST_OUT).href}?at=${Date.now()}`) as Promise<typeof import('../packages/node-render/src/index.ts')>;
  });
  return host;
}
