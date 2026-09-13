// @vitest-environment node
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { IndexEntry } from '../story/types';
import { forge } from './plugin';

const story = (title: string, ...names: string[]) =>
  `export default { title: '${title}' };\n${names.map((n) => `export const ${n} = {};`).join('\n')}\n`;

describe('forge vite plugin', () => {
  let root: string;
  let server: ViteDevServer;
  let http: Server;
  let port: number;

  const loadIndex = async () =>
    ((await server.ssrLoadModule('virtual:forge/index.js')) as { default: IndexEntry[] }).default;

  beforeAll(async () => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'forge-plugin-')));
    writeFileSync(join(root, 'a.stories.tsx'), story('ui/A', 'Second', 'First'));
    writeFileSync(join(root, 'b.stories.tsx'), story('ui/B', 'Only'));
    server = await createServer({
      root,
      configFile: false,
      plugins: [forge({ stories: ['*.stories.tsx'] })],
      server: { middlewareMode: true },
      appType: 'custom',
      logLevel: 'silent',
    });
    http = createHttpServer(server.middlewares);
    await new Promise<void>((done) => http.listen(0, 'localhost', done));
    port = (http.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise((done) => http?.close(done));
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('resolves its virtual modules', async () => {
    expect((await server.pluginContainer.resolveId('virtual:forge/index.js'))?.id).toBe('\0virtual:forge/index.js');
  });

  it('indexes every story file, each in source order', async () => {
    expect((await loadIndex()).map((e) => e.id)).toEqual(['ui-a--second', 'ui-a--first', 'ui-b--only']);
  });

  it('writes an importer per story file', async () => {
    const result = await server.transformRequest('virtual:forge/importers.js');
    expect(result?.code).toContain(join(root, 'a.stories.tsx'));
    expect(result?.code).toContain(join(root, 'b.stories.tsx'));
  });

  /** The body forge answered with, or null when the request fell through the whole stack. */
  const request = async (method: string, path: string) => {
    const res = await fetch(`http://localhost:${port}${path}`, { method });
    return res.status === 200 ? res.text() : null;
  };

  it('serves the workshop and frame documents', async () => {
    expect(await request('GET', '/')).toContain('/@id/virtual:forge/shell-entry.js');
    expect(await request('GET', '/index.html')).toContain('/@id/virtual:forge/shell-entry.js');
    expect(await request('GET', '/frame.html')).toContain('/@id/virtual:forge/frame-entry.js');
  });

  it('lets every other request fall through', async () => {
    expect(await request('GET', '/other.html')).toBeNull();
    expect(await request('POST', '/')).toBeNull();
  });

  it('re-indexes when a story file is added', async () => {
    writeFileSync(join(root, 'c.stories.tsx'), story('ui/C', 'Third'));
    await expect.poll(async () => (await loadIndex()).length, { timeout: 5000, interval: 50 }).toBe(4);
    expect((await loadIndex()).at(-1)?.id).toBe('ui-c--third');
  });
});
