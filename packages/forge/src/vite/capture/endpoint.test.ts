// @vitest-environment node
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type Plugin, type ViteDevServer } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forge } from '../plugin';
import type { CaptureBrowser } from './browser';
import type { CapturePayload } from './payload';

const launch = vi.hoisted(() => vi.fn());
vi.mock('./browser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./browser')>();
  return { ...actual, launchCaptureBrowser: launch };
});
const { launchCaptureBrowser: realLaunch } = await vi.importActual<typeof import('./browser')>('./browser');

const POLLED = { usePolling: true, interval: 50 };

// The entries import forge's and labkit's published modules, which a temp root cannot resolve.
const stubs: Plugin = {
  name: 'stub-weasel',
  enforce: 'pre',
  resolveId: (id) => (id.startsWith('@weasel-js/') ? `\0stub:${id}.js` : undefined),
  load: (id) => (id.startsWith('\0stub:') ? 'export const mountCapture = () => { globalThis.mounted = true; };\n' : undefined),
};

const story = (label: string) => `export default { title: 'ui/A' };\nexport const Only = { args: { label: '${label}' } };\n`;

const payload: CapturePayload = {
  story: 'ui-a--only',
  isolate: false,
  config: { label: 'Go' },
  state: null,
  globals: {},
  overrides: {},
  playhead: null,
  box: { width: 100, height: 50 },
  layout: 'padded',
  dpr: 1,
};

/** A real PNG signature followed by a counter, so each capture's bytes are its own. */
const pngNumbered = (n: number) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from([n])]);

describe('capture endpoint', () => {
  let root: string;
  let server: ViteDevServer;
  let http: Server;
  let url: string;

  const start = async (base = '/') => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'forge-capture-')));
    writeFileSync(join(root, 'a.stories.tsx'), story('first'));
    server = await createServer({
      root,
      base,
      configFile: false,
      plugins: [stubs, forge({ stories: ['*.stories.tsx'] })],
      server: { middlewareMode: true, watch: POLLED },
      appType: 'custom',
      optimizeDeps: { noDiscovery: true },
      logLevel: 'silent',
    });
    http = createHttpServer(server.middlewares);
    await new Promise<void>((done) => http.listen(0, 'localhost', done));
    url = `http://localhost:${(http.address() as AddressInfo).port}${base}`;
  };
  const post = (body: unknown) =>
    fetch(`${url}__forge/capture`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  beforeEach(() => launch.mockReset());
  afterEach(async () => {
    await new Promise((done) => http?.close(done));
    await server?.close();
    rmSync(root, { recursive: true, force: true, maxRetries: 3 });
  });

  it('reports itself unavailable without playwright, and answers a POST with 503', async () => {
    launch.mockImplementation(() => realLaunch(() => Promise.reject(new Error("Cannot find package 'playwright'"))));
    await start();
    const status = await fetch(`${url}__forge/capture`);
    expect(status.status).toBe(200);
    expect(await status.json()).toEqual({ available: false, reason: 'install playwright' });

    const res = await post(payload);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ available: false, reason: 'install playwright' });
  });

  it('answers a malformed payload with 400, naming the field', async () => {
    launch.mockResolvedValue({ capture: vi.fn(), close: vi.fn(async () => {}) } satisfies CaptureBrowser);
    await start();
    const res = await post({ ...payload, dpr: 9 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: expect.stringContaining('dpr') });
  });

  it('serves a cached capture without launching again, and captures afresh after a story edit', async () => {
    let n = 0;
    const capture = vi.fn(async () => pngNumbered((n += 1)));
    const close = vi.fn(async () => {});
    launch.mockResolvedValue({ capture, close } satisfies CaptureBrowser);
    await start();

    const first = await post(payload);
    expect(first.status).toBe(200);
    expect(first.headers.get('content-type')).toBe('image/png');
    const firstBytes = Buffer.from(await first.arrayBuffer());
    expect(firstBytes).toEqual(pngNumbered(1));
    expect(capture).toHaveBeenCalledWith(`${url}__forge/capture.html`, payload);

    const again = await post(payload);
    expect(Buffer.from(await again.arrayBuffer())).toEqual(firstBytes);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(launch).toHaveBeenCalledTimes(1);

    // The client graph has to hold the story for vite to hand the edit to `hotUpdate`.
    await server.environments.client.transformRequest(join(root, 'a.stories.tsx'));
    writeFileSync(join(root, 'a.stories.tsx'), story('second'));
    await vi.waitFor(
      async () => {
        const res = await post(payload);
        expect(Buffer.from(await res.arrayBuffer())).toEqual(pngNumbered(2));
      },
      { timeout: 15_000, interval: 100 },
    );
    expect(capture).toHaveBeenCalledTimes(2);
    expect(launch).toHaveBeenCalledTimes(1);

    await server.close();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('captures an isolated story on the frame page', async () => {
    const capture = vi.fn(async () => pngNumbered(1));
    launch.mockResolvedValue({ capture, close: vi.fn(async () => {}) } satisfies CaptureBrowser);
    await start();
    await post({ ...payload, isolate: true });
    expect(capture).toHaveBeenCalledWith(`${url}__forge/capture-frame.html`, { ...payload, isolate: true });
  });

  it('serves the capture pages under base', async () => {
    launch.mockResolvedValue({ capture: vi.fn(), close: vi.fn(async () => {}) } satisfies CaptureBrowser);
    await start('/base/');
    const shell = await fetch(`${url}__forge/capture.html`);
    expect(shell.status).toBe(200);
    expect(shell.headers.get('content-type')).toBe('text/html');
    expect(await shell.text()).toContain('capture-entry.js');
    const frame = await fetch(`${url}__forge/capture-frame.html`);
    expect(await frame.text()).toContain('capture-frame-entry.js');
    expect((await fetch(`${url}__forge/capture`)).status).toBe(200);
    expect((await fetch(url.replace('/base/', '/') + '__forge/capture.html')).status).toBe(404);

    const entry = (await server.environments.client.transformRequest('virtual:forge/capture-entry.js'))?.code ?? '';
    expect(entry).toContain('mountCapture');
  });
});
