/**
 * Node module hooks that let the bench workers import the repo's source
 * natively, without Vite's module runner. They do what Vite did for the
 * source: resolve `@weasel-js/*` and core's bare paths through
 * `weaselAliases`, find extensionless imports, compile TS and TSX with
 * esbuild, load a stylesheet as nothing (a CSS module as a class-name proxy),
 * a `?url` import as its file URL, and JSON as its value.
 *
 * Not `tsx`: it compiles with esbuild's `keepNames`, which wraps every
 * closure in a `__name()` call at creation and doubled `scene.setPose`.
 */
import { registerHooks } from 'node:module';
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transformSync } from 'esbuild';
import { weaselAliases } from '../../../scripts/vite-aliases.ts';

const repoRoot = resolve(import.meta.dirname, '../../..');
const aliases = weaselAliases(repoRoot);
const PROBES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
const SOURCE = /\.(ts|tsx)$/;
const CSS_MODULE = `export default new Proxy({}, { get: (_, key) => typeof key === 'string' ? key : undefined });`;
const TSCONFIG = { compilerOptions: { jsx: 'react-jsx', verbatimModuleSyntax: true, useDefineForClassFields: true } };

const isFile = (p) => statSync(p, { throwIfNoEntry: false })?.isFile() ?? false;

/** The repo path `specifier` names, before probing extensions, or null for a package Node resolves itself. */
function target(specifier, parentURL) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    if (!parentURL?.startsWith('file:') || parentURL.includes('/node_modules/')) return null;
    return resolve(dirname(fileURLToPath(parentURL)), specifier);
  }
  for (const { find, replacement } of aliases) {
    if (find.test(specifier)) return specifier.replace(find, replacement);
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const [path, query] = specifier.split('?');
    const base = target(path, context.parentURL);
    if (base === null) return nextResolve(specifier, context);
    const found = PROBES.map((ext) => base + ext).find(isFile);
    if (!found) return nextResolve(specifier, context);
    const url = pathToFileURL(found).href + (query === undefined ? '' : `?${query}`);
    return { url, format: SOURCE.test(found) || query !== undefined ? 'module' : undefined, shortCircuit: true };
  },
  load(url, context, nextLoad) {
    if (!url.startsWith('file:')) return nextLoad(url, context);
    const { pathname, search } = new URL(url);
    const file = fileURLToPath(url.slice(0, url.length - search.length));
    const module = (source) => ({ format: 'module', source, shortCircuit: true });
    if (search === '?url') return module(`export default ${JSON.stringify(pathToFileURL(file).href)};`);
    if (pathname.endsWith('.module.css')) return module(CSS_MODULE);
    if (pathname.endsWith('.css')) return module('');
    if (pathname.endsWith('.json') && !file.includes('/node_modules/')) {
      return module(`export default ${readFileSync(file, 'utf8')};`);
    }
    if (SOURCE.test(pathname) && !file.includes('/node_modules/')) {
      const { code } = transformSync(readFileSync(file, 'utf8'), {
        loader: pathname.endsWith('.tsx') ? 'tsx' : 'ts',
        format: 'esm',
        target: 'esnext',
        sourcefile: file,
        sourcemap: 'inline',
        tsconfigRaw: TSCONFIG,
      });
      return module(code);
    }
    return nextLoad(url, context);
  },
});
