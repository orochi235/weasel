// @vitest-environment node
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type Plugin, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { keepErrorsHome } from './vitest-browser-overlay.ts';

/** The payload types a connected page receives while another page's request fails to transform. */
async function heardBy(root: string, plugins: Plugin[]): Promise<string[]> {
  // `hmr: false` is what vitest sets on every server it starts.
  const server: ViteDevServer = await createServer({
    root,
    configFile: false,
    plugins,
    server: { hmr: false, watch: null, host: '127.0.0.1', port: 0 },
    optimizeDeps: { noDiscovery: true },
    logLevel: 'silent',
  });
  try {
    await server.listen();
    const { port } = server.httpServer!.address() as AddressInfo;
    const socket = new WebSocket(`ws://127.0.0.1:${port}/?token=${server.config.webSocketToken}`, 'vite-hmr');
    const heard: string[] = [];
    const done = new Promise<void>((resolve) => {
      socket.addEventListener('message', (event) => {
        const payload = JSON.parse(String(event.data)) as { type: string; event?: string };
        if (payload.event === 'probe:done') resolve();
        else heard.push(payload.type);
      });
    });
    await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
    expect((await fetch(`http://127.0.0.1:${port}/broken.ts`)).status).toBe(500);
    // One socket keeps its order, so anything the failure sent arrives before this.
    server.environments.client.hot.send('probe:done');
    await done;
    socket.close();
    return heard;
  } finally {
    await server.close();
  }
}

describe('keepErrorsHome', () => {
  let root: string;

  beforeAll(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'keep-errors-home-')));
    writeFileSync(join(root, 'broken.ts'), "import styles from './missing.module.css';\nexport default styles;\n");
  });

  afterAll(() => rmSync(root, { recursive: true, force: true, maxRetries: 3 }));

  it('is needed: with HMR off, vite still sends a failed transform to every connected page', async () => {
    expect(await heardBy(root, [])).toContain('error');
  });

  it('keeps the failure from the other pages', async () => {
    expect(await heardBy(root, [keepErrorsHome()])).not.toContain('error');
  });
});
