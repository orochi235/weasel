import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createServer } from 'vite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// `browserDeps` only helps while vite keys its dep cache on `optimizeDeps.include`. This holds vite to it.

let root: string;
const put = (path: string, text: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};
const cache = (file: string) => join(root, 'node_modules/.vite/deps', file);
const LEFTOVER = 'left-by-the-last-run';

/** Start a server on the tree and return the dependencies its cache holds once it is listening. */
async function prebundled(include: string[]): Promise<string[]> {
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    // A watcher on the temp directory takes seconds to start, some of the time.
    server: { port: 0, host: '127.0.0.1', ws: false, hmr: false, watch: null },
    // With discovery off vite has pre-bundled `include` by the time `listen` resolves.
    optimizeDeps: { noDiscovery: true, include },
  });
  try {
    await server.listen();
    return Object.keys(JSON.parse(readFileSync(cache('_metadata.json'), 'utf8')).optimized);
  } finally {
    await server.close();
  }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'browser-deps-vite-'));
  for (const dep of ['dep-a', 'dep-b']) {
    put(`node_modules/${dep}/package.json`, JSON.stringify({ name: dep, version: '1.0.0', main: 'index.js' }));
    put(`node_modules/${dep}/index.js`, `module.exports = '${dep}';\n`);
  }
  put('package.json', JSON.stringify({ name: 'probe', type: 'module' }));
  put('package-lock.json', '{}');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('vite’s dep cache, keyed on optimizeDeps.include', () => {
  it('survives a start with the same list', async () => {
    expect(await prebundled(['dep-a'])).toEqual(['dep-a']);
    put(`node_modules/.vite/deps/${LEFTOVER}`, '');
    expect(await prebundled(['dep-a'])).toEqual(['dep-a']);
    expect(existsSync(cache(LEFTOVER))).toBe(true);
  });

  it('is discarded and rebuilt, new dependency included, when the list grows', async () => {
    await prebundled(['dep-a']);
    put(`node_modules/.vite/deps/${LEFTOVER}`, '');
    expect(await prebundled(['dep-a', 'dep-b'])).toEqual(['dep-a', 'dep-b']);
    expect(existsSync(cache(LEFTOVER))).toBe(false);
  });
});
