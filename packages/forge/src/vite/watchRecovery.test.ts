// @vitest-environment node
import { mkdtempSync, realpathSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLogger, createServer, type HotPayload, type Plugin, type ViteDevServer } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchRecovery } from './watchRecovery';

/** The quiet check waits for silence, then runs every `QUIET_MS`; a loaded machine still gets there well inside this. */
const PUSHED = { timeout: 10_000, interval: 20 };
const QUIET_MS = 50;

interface Started {
  root: string;
  server: ViteDevServer;
  get: (url: string) => Promise<string>;
  warnings: string[];
  pushed: HotPayload[];
}

/**
 * A dev server whose watcher ignores every `.ts` file under a fresh root, so a write to one is a missed event every
 * time rather than on a bad day.
 */
async function start(plugins: Plugin[], files: Record<string, string>): Promise<Started> {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'forge-recovery-')));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(root, name), text);
  const warnings: string[] = [];
  const logger = createLogger('warn');
  logger.warn = (msg) => void warnings.push(msg);
  const server = await createServer({
    root,
    configFile: false,
    plugins,
    server: { middlewareMode: true, watch: { ignored: ['**/*.ts'] } },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
    customLogger: logger,
  });
  const http: Server = createHttpServer(server.middlewares);
  await new Promise<void>((done) => http.listen(0, 'localhost', done));
  const { port } = http.address() as AddressInfo;
  const pushed: HotPayload[] = [];
  vi.spyOn(server.environments.client.hot, 'send').mockImplementation((payload: unknown) => {
    if (typeof payload === 'object' && payload !== null) pushed.push(payload as HotPayload);
  });
  cleanups.push(async () => {
    await new Promise((done) => http.close(done));
    await server.close();
    rmSync(root, { recursive: true, force: true, maxRetries: 3 });
  });
  const get = async (url: string) => (await fetch(`http://localhost:${port}${url}`)).text();
  return { root, server, get, warnings, pushed };
}

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

/** Rewrites `file` and moves its modification time a minute on, so the change shows on any filesystem's clock. */
const edit = (file: string, text: string) => {
  const { mtime } = statSync(file);
  writeFileSync(file, text);
  const later = new Date(mtime.getTime() + 60_000);
  utimesSync(file, later, later);
};

describe('watchRecovery', () => {
  it('serves an edit the watcher never reported on the next request, and says which file it was', async () => {
    const { root, get, warnings } = await start([watchRecovery({ quietMs: 60_000 })], { 'part.ts': 'export const part = 0;\n' });
    expect(await get('/part.ts')).toContain('part = 0');
    edit(join(root, 'part.ts'), 'export const part = 1;\n');
    expect(await get('/part.ts')).toContain('part = 1');
    expect(warnings).toEqual([expect.stringContaining('[watch] part.ts changed with no file event; serving the new text')]);
    expect(await get('/part.ts')).toContain('part = 1');
    expect(warnings).toHaveLength(1);
  });

  it('pushes an edit the watcher never reported once it has been quiet, with no request', async () => {
    const { root, get, warnings, pushed } = await start([watchRecovery({ quietMs: QUIET_MS })], {
      'part.ts': 'export const part = 0;\n',
    });
    expect(await get('/part.ts')).toContain('part = 0');
    edit(join(root, 'part.ts'), 'export const part = 1;\n');
    await expect.poll(() => pushed.map((p) => p.type), PUSHED).toContain('full-reload');
    expect(warnings).toEqual([expect.stringContaining('[watch] part.ts changed with no file event; pushing it to the page')]);
    expect(await get('/part.ts')).toContain('part = 1');
  });

  it('hands an importer that accepts the module a hot update rather than a reload', async () => {
    const { root, get, pushed } = await start([watchRecovery({ quietMs: QUIET_MS })], {
      'main.ts': `import { part } from './part.ts';\nconsole.log(part);\nimport.meta.hot?.accept(() => {});\n`,
      'part.ts': 'export const part = 0;\n',
    });
    await get('/main.ts');
    await get('/part.ts');
    edit(join(root, 'part.ts'), 'export const part = 1;\n');
    await expect.poll(() => pushed.flatMap((p) => (p.type === 'update' ? p.updates.map((u) => u.path) : [])), PUSHED).toContain('/main.ts');
    expect(pushed.map((p) => p.type)).not.toContain('full-reload');
  });

  it('recovers once when a server is given it twice', async () => {
    const { root, get, warnings } = await start([watchRecovery({ quietMs: 60_000 }), watchRecovery({ quietMs: 60_000 })], {
      'part.ts': 'export const part = 0;\n',
    });
    await get('/part.ts');
    edit(join(root, 'part.ts'), 'export const part = 1;\n');
    expect(await get('/part.ts')).toContain('part = 1');
    expect(warnings).toHaveLength(1);
  });
});
