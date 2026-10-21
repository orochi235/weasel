// @vitest-environment node
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type Plugin, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { skipWake } from '../apps/forge/viteShared.ts';
import { forge } from '../packages/forge/src/vite/plugin.ts';
import { localWake } from './vite-wake.ts';

// Wake is a checkout on this machine, not a dependency, so a stand-in takes its place: it writes its badge into
// the page's markup, where the real one injects a client that draws it. Its absence from the HTML is the proxy.
const FAKE_WAKE = `export function wake() {
  return { name: 'fake-wake', transformIndexHtml: () => [{ tag: 'div', attrs: { class: 'wake-badge' }, injectTo: 'body' }] };
}
`;

const stubs: Plugin = {
  name: 'stub-weasel',
  enforce: 'pre',
  resolveId: (id) => (id.startsWith('@weasel-js/') ? `\0stub:${id}.js` : undefined),
  load: (id) => (id.startsWith('\0stub:') ? 'export const mountWorkshop = () => {};\nexport const mountCapture = () => {};\n' : undefined),
};

describe('localWake in the forge workshop', () => {
  let root: string;
  let server: ViteDevServer;
  let http: Server;
  let url: string;
  const before = process.env.WAKE_PATH;

  beforeAll(async () => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'forge-wake-')));
    writeFileSync(join(root, 'wake.mjs'), FAKE_WAKE);
    writeFileSync(join(root, 'a.stories.tsx'), "export default { title: 'ui/A' };\nexport const Only = {};\n");
    process.env.WAKE_PATH = join(root, 'wake.mjs');
    const wake = await localWake({ skip: skipWake });
    server = await createServer({
      root,
      configFile: false,
      plugins: [stubs, forge({ stories: ['*.stories.tsx'] }), wake],
      server: { middlewareMode: true, watch: null },
      appType: 'custom',
      optimizeDeps: { noDiscovery: true },
      logLevel: 'silent',
    });
    http = createHttpServer(server.middlewares);
    await new Promise<void>((done) => http.listen(0, '127.0.0.1', done));
    url = `http://127.0.0.1:${(http.address() as AddressInfo).port}/`;
  });

  afterAll(async () => {
    if (before === undefined) delete process.env.WAKE_PATH;
    else process.env.WAKE_PATH = before;
    await new Promise((done) => http?.close(done));
    await server?.close();
    rmSync(root, { recursive: true, force: true, maxRetries: 3 });
  });

  it('badges the workshop page', async () => {
    expect(await (await fetch(url)).text()).toContain('wake-badge');
  });

  it('leaves no wake badge on either capture page', async () => {
    for (const page of ['__forge/capture.html', '__forge/capture-frame.html']) {
      const res = await fetch(`${url}${page}`);
      expect(res.status).toBe(200);
      expect(await res.text()).not.toContain('wake-badge');
    }
  });
});
