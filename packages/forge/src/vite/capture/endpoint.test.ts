// @vitest-environment node
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer, request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type Plugin, type ViteDevServer } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forge } from '../plugin';
import type { CaptureBrowser } from './browser';
import { urlHost } from './endpoint';
import type { CapturePayload } from './payload';

const launch = vi.hoisted(() => vi.fn());
const availability = vi.hoisted(() => vi.fn());
vi.mock('./browser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./browser')>();
  return { ...actual, launchCaptureBrowser: launch, captureAvailability: availability };
});
const real = await vi.importActual<typeof import('./browser')>('./browser');

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
  lab: { globals: {}, mode: 'light' },
};

/** A real PNG signature followed by a counter, so each capture's bytes are its own. */
const pngNumbered = (n: number) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from([n])]);

const fakeBrowser = (capture = vi.fn(async () => pngNumbered(1))) =>
  ({ capture, close: vi.fn(async () => {}) }) satisfies CaptureBrowser;

describe('urlHost', () => {
  it('writes a socket address as a URL host: IPv6 bracketed, its zone id escaped as RFC 6874 writes it, IPv4-mapped unwrapped', () => {
    expect(urlHost('127.0.0.1')).toBe('127.0.0.1');
    expect(urlHost('::1')).toBe('[::1]');
    expect(urlHost('::ffff:10.0.0.5')).toBe('10.0.0.5');
    expect(urlHost('fe80::1%en0')).toBe('[fe80::1%25en0]');
  });
});

describe('capture endpoint', () => {
  let root: string;
  let server: ViteDevServer;
  let http: Server;
  let port: number;
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
    await new Promise<void>((done) => http.listen(0, '127.0.0.1', done));
    port = (http.address() as AddressInfo).port;
    url = `http://127.0.0.1:${port}${base}`;
  };
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${url}__forge/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  /** A POST with headers `fetch` will not let a caller write, `Host` among them. */
  const rawPost = (body: unknown, headers: Record<string, string>) =>
    new Promise<number>((resolve, reject) => {
      const req = request(`${url}__forge/capture`, { method: 'POST', headers }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on('error', reject);
      req.end(JSON.stringify(body));
    });

  beforeEach(() => {
    launch.mockReset();
    availability.mockReset();
    availability.mockResolvedValue({ available: true });
  });
  afterEach(async () => {
    await new Promise((done) => http?.close(done));
    await server?.close();
    rmSync(root, { recursive: true, force: true, maxRetries: 3 });
  });

  it('reports itself unavailable without playwright, and answers a POST with 503', async () => {
    const missing = () => Promise.reject(new Error("Cannot find package 'playwright'"));
    availability.mockImplementation(() => real.captureAvailability(missing));
    launch.mockImplementation(() => real.launchCaptureBrowser(missing));
    await start();
    const status = await fetch(`${url}__forge/capture`);
    expect(status.status).toBe(200);
    expect(await status.json()).toEqual({ available: false, reason: 'install playwright' });

    const res = await post(payload);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ available: false, reason: 'install playwright' });
  });

  it('answers a GET without launching Chromium, and reports a launch failure on the first POST', async () => {
    launch.mockResolvedValue({ unavailable: 'Executable doesn’t exist' });
    await start();
    expect(await (await fetch(`${url}__forge/capture`)).json()).toEqual({ available: true });
    expect(launch).not.toHaveBeenCalled();

    const res = await post(payload);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ available: false, reason: 'Executable doesn’t exist' });
  });

  it('answers a malformed payload with 400, naming the field', async () => {
    launch.mockResolvedValue(fakeBrowser());
    await start();
    const res = await post({ ...payload, dpr: 9 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: expect.stringContaining('dpr') });
  });

  it('loads the capture page from its own socket, whatever Host the request names', async () => {
    const browser = fakeBrowser();
    launch.mockResolvedValue(browser);
    await start();
    const status = await rawPost(payload, { 'Content-Type': 'application/json', Host: '203.0.113.5:1234' });
    expect(status).toBe(200);
    expect(browser.capture).toHaveBeenCalledWith(`http://127.0.0.1:${port}/__forge/capture.html`, payload);
  });

  it('refuses a POST that is not JSON with 415', async () => {
    launch.mockResolvedValue(fakeBrowser());
    await start();
    const res = await post(payload, { 'Content-Type': 'text/plain' });
    expect(res.status).toBe(415);
  });

  it('refuses a POST from another origin with 403, and takes one from its own', async () => {
    const browser = fakeBrowser();
    launch.mockResolvedValue(browser);
    await start();
    expect((await post(payload, { Origin: 'http://203.0.113.5:8080' })).status).toBe(403);
    expect(browser.capture).not.toHaveBeenCalled();
    expect((await post(payload, { Origin: `http://localhost:${port}` })).status).toBe(200);
    expect((await post(payload, { Origin: `http://127.0.0.1:${port}` })).status).toBe(200);
  });

  it('serves a cached capture without launching again, and captures afresh after a story edit', async () => {
    let n = 0;
    const browser = fakeBrowser(vi.fn(async () => pngNumbered((n += 1))));
    launch.mockResolvedValue(browser);
    await start();

    const first = await post(payload);
    expect(first.status).toBe(200);
    expect(first.headers.get('content-type')).toBe('image/png');
    const firstBytes = Buffer.from(await first.arrayBuffer());
    expect(firstBytes).toEqual(pngNumbered(1));
    expect(browser.capture).toHaveBeenCalledWith(`${url}__forge/capture.html`, payload);

    const again = await post(payload);
    expect(Buffer.from(await again.arrayBuffer())).toEqual(firstBytes);
    expect(browser.capture).toHaveBeenCalledTimes(1);
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
    expect(browser.capture).toHaveBeenCalledTimes(2);
    expect(launch).toHaveBeenCalledTimes(1);

    await server.close();
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it('captures an isolated story on the frame page', async () => {
    const browser = fakeBrowser();
    launch.mockResolvedValue(browser);
    await start();
    await post({ ...payload, isolate: true });
    expect(browser.capture).toHaveBeenCalledWith(`${url}__forge/capture-frame.html`, { ...payload, isolate: true });
  });

  it('serves the capture pages under base', async () => {
    launch.mockResolvedValue(fakeBrowser());
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
