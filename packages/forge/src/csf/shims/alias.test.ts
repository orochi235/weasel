// @vitest-environment node
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer, type Plugin, type ViteDevServer } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';
import { weaselAliases } from '../../../../../scripts/vite-aliases';
import { forge } from '../../vite/plugin';

const REPO = resolve(__dirname, '../../../../..');
const SOURCE_SHIM = resolve(REPO, 'packages/forge/src/preview-api.ts');
const BUILT_PLUGIN = resolve(REPO, 'packages/forge/dist/vite/index.js');
const BUILT_SHIM = resolve(REPO, 'packages/forge/dist/csf/preview-api.js');

describe('storybook shims', () => {
  let root: string | undefined;
  let server: ViteDevServer | undefined;

  afterEach(async () => {
    await server?.close();
    if (root) rmSync(root, { recursive: true, force: true });
  });

  const start = async (plugins: Plugin[], alias = weaselAliases(REPO)) => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'forge-shims-')));
    server = await createServer({
      root,
      configFile: false,
      resolve: { alias },
      plugins,
      server: { middlewareMode: true, watch: null },
      appType: 'custom',
      logLevel: 'silent',
    });
    return server;
  };
  const resolveFrom = async (s: ViteDevServer, id: string) =>
    (await s.pluginContainer.resolveId(id, join(root ?? '', 'a.tsx')))?.id;

  it('points both preview-api specifiers at @weasel-js/forge/preview-api, through the app’s aliases', async () => {
    const s = await start(forge({ stories: [] }));
    expect(await resolveFrom(s, 'storybook/preview-api')).toBe(SOURCE_SHIM);
    expect(await resolveFrom(s, '@storybook/preview-api')).toBe(SOURCE_SHIM);
  });

  it('leaves them alone when shims are off', async () => {
    const s = await start(forge({ stories: [], storybookShims: false }));
    expect(await resolveFrom(s, 'storybook/preview-api')).not.toBe(SOURCE_SHIM);
  });

  // Needs `npm run build -w @weasel-js/forge`; CI runs the tests before it builds.
  it.runIf(existsSync(BUILT_PLUGIN))('resolves the published shim from the built plugin with no aliases', async () => {
    const built = (await import(pathToFileURL(BUILT_PLUGIN).href)) as { forge: typeof forge };
    const s = await start(built.forge({ stories: [] }), []);
    expect(await resolveFrom(s, 'storybook/preview-api')).toBe(BUILT_SHIM);
    expect(existsSync(BUILT_SHIM)).toBe(true);
  });
});
