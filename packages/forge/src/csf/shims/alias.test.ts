// @vitest-environment node
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';
import { forge } from '../../vite/plugin';

const SHIM = resolve(__dirname, 'preview-api.ts');

describe('storybook shims', () => {
  let root: string | undefined;
  let server: ViteDevServer | undefined;

  afterEach(async () => {
    await server?.close();
    if (root) rmSync(root, { recursive: true, force: true });
  });

  const start = async (storybookShims?: boolean) => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'forge-shims-')));
    server = await createServer({
      root,
      configFile: false,
      plugins: [forge({ stories: [], storybookShims })],
      server: { middlewareMode: true, watch: null },
      appType: 'custom',
      logLevel: 'silent',
    });
    return server;
  };

  it('points both preview-api specifiers at the useArgs shim by default', async () => {
    const s = await start();
    expect((await s.pluginContainer.resolveId('storybook/preview-api', join(root ?? '', 'a.tsx')))?.id).toBe(SHIM);
    expect((await s.pluginContainer.resolveId('@storybook/preview-api', join(root ?? '', 'a.tsx')))?.id).toBe(SHIM);
  });

  it('leaves them alone when shims are off', async () => {
    const s = await start(false);
    expect((await s.pluginContainer.resolveId('storybook/preview-api', join(root ?? '', 'a.tsx')))?.id).not.toBe(SHIM);
  });
});
