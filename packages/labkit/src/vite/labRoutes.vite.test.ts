// @vitest-environment node
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createServer,
  type PluginOption,
  type PreviewServer,
  preview,
  type ViteDevServer,
} from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { labRoutes } from './labRoutes';

const PAGE = '<!doctype html><title>fast money</title><p>page</p>';
const DOCUMENT = { 'sec-fetch-dest': 'document', accept: 'text/html' };
const HTML = { accept: 'text/html,application/xhtml+xml,*/*;q=0.8' };

describe('labRoutes on a real server', () => {
  let root: string;
  beforeAll(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'labkit-routes-')));
    writeFileSync(join(root, 'index.html'), '<!doctype html><title>board</title>');
    writeFileSync(join(root, 'fastmoney.html'), PAGE);
    // A module answering the same path, as `fastMoney.tsx` does on a case-insensitive disk.
    writeFileSync(join(root, 'fastmoney.ts'), 'export const fastMoney = 1;\n');
    mkdirSync(join(root, 'dist'));
    writeFileSync(join(root, 'dist', 'fastmoney.html'), PAGE);
  });
  afterAll(() => rmSync(root, { recursive: true, force: true, maxRetries: 3 }));

  describe('dev', () => {
    const serve = async (plugins: PluginOption[]) => {
      const vite = await createServer({
        root,
        base: '/gg/',
        configFile: false,
        plugins,
        appType: 'mpa',
        server: { middlewareMode: true, ws: false },
        optimizeDeps: { noDiscovery: true },
        logLevel: 'silent',
      });
      const http = createHttpServer(vite.middlewares);
      await new Promise<void>((done) => http.listen(0, '127.0.0.1', done));
      const origin = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
      return { vite, http, origin };
    };
    let bare: { vite: ViteDevServer; http: Server; origin: string };
    let routed: { vite: ViteDevServer; http: Server; origin: string };
    beforeAll(async () => {
      bare = await serve([]);
      routed = await serve([labRoutes()]);
    });
    afterAll(async () => {
      for (const s of [bare, routed]) {
        s?.http.close();
        await s?.vite.close();
      }
    });

    // Vite skips its transform for a request whose Sec-Fetch-Dest says document, but a browser sends
    // that header only to a trustworthy origin, so a page opened at a LAN address over http has none.
    it('answers a page that a module shares its name with, where Vite alone answers the module', async () => {
      const without = await fetch(`${bare.origin}/gg/fastmoney`, { headers: HTML });
      expect(await without.text()).toContain('fastMoney');
      for (const headers of [HTML, DOCUMENT]) {
        const res = await fetch(`${routed.origin}/gg/fastmoney?present`, { headers });
        expect(res.headers.get('content-type')).toContain('text/html');
        expect(await res.text()).toContain('<title>fast money</title>');
      }
    });

    it('still serves the module to a script request', async () => {
      const res = await fetch(`${routed.origin}/gg/fastmoney`, {
        headers: { 'sec-fetch-dest': 'script', accept: '*/*' },
      });
      expect(await res.text()).toContain('fastMoney');
    });
  });

  it('answers a clean route in preview, from the build directory', async () => {
    const server: PreviewServer = await preview({
      root,
      base: '/gg/',
      configFile: false,
      plugins: [labRoutes()],
      build: { outDir: 'dist' },
      preview: { port: 0, host: '127.0.0.1', open: false },
      logLevel: 'silent',
    });
    try {
      const { port } = server.httpServer.address() as AddressInfo;
      const res = await fetch(`http://127.0.0.1:${port}/gg/fastmoney`, { headers: HTML });
      expect(await res.text()).toContain('<title>fast money</title>');
    } finally {
      await server.close();
    }
  });
});
