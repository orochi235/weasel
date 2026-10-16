// @vitest-environment node
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, createServer, type Rolldown, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { weaselPrefsCss } from './vite';

const BUILD = join(import.meta.dirname, 'build.ts');
/** Under a loaded machine the watcher's first scan alone has taken seconds. */
const FOLLOWS = { timeout: 15_000, interval: 250 };

const look = (gap: number) => `export const GAP = ${gap};\n`;

describe('weaselPrefsCss', () => {
  let root: string;
  let server: ViteDevServer;
  const plugins = () => [weaselPrefsCss({ schemas: { './prefs.ts': 'SCHEMA' }, css: { root: '.app' } })];

  beforeAll(async () => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'weasel-prefs-css-')));
    writeFileSync(join(root, 'look.ts'), look(4));
    writeFileSync(
      join(root, 'prefs.ts'),
      [
        `import { pref } from ${JSON.stringify(BUILD)};`,
        `import { GAP } from './look';`,
        `export const SCHEMA = pref.group('Prefs', {`,
        `  mode: pref.enum('Mode', 'dark', ['dark', 'light']),`,
        `  gap: pref.number('Gap', GAP, { unit: { scale: 1, suffix: 'px' }, splitBy: ['mode'] }),`,
        `});`,
      ].join('\n'),
    );
    writeFileSync(join(root, 'main.js'), `import 'virtual:weasel-prefs.css';\n`);
    server = await createServer({
      root,
      configFile: false,
      plugins: plugins(),
      server: { middlewareMode: true, ws: false },
      appType: 'custom',
      optimizeDeps: { noDiscovery: true },
      logLevel: 'silent',
    });
  });

  afterAll(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true, maxRetries: 3 });
  });

  const sheetUrl = async (): Promise<string> => {
    const main = (await server.transformRequest('/main.js'))?.code ?? '';
    const url = /import\s+["']([^"']*weasel-prefs\.css[^"']*)["']/.exec(main)?.[1];
    expect(url).toBe('/@id/__x00__virtual:weasel-prefs.css');
    // What the dev middleware turns that URL back into before transforming it.
    return url!.replace('/@id/__x00__', '\0');
  };

  it('serves the schema defaults in dev as a style module', async () => {
    const code = (await server.transformRequest(await sheetUrl()))?.code ?? '';
    expect(code).toContain('__vite__updateStyle');
    expect(code).toContain('--gap: 4px;');
    expect(code).toContain(":where(.app[data-mode='light'])");
  });

  it('rewrites the sheet when a module the schema imports changes', async () => {
    const url = await sheetUrl();
    await expect
      .poll(async () => {
        writeFileSync(join(root, 'look.ts'), look(7));
        return (await server.transformRequest(url))?.code ?? '';
      }, FOLLOWS)
      .toContain('--gap: 7px;');
  });

  it('emits the sheet as a CSS asset in a build', async () => {
    writeFileSync(join(root, 'look.ts'), look(5));
    const out = (await build({
      root,
      configFile: false,
      plugins: plugins(),
      logLevel: 'silent',
      build: { write: false, rolldownOptions: { input: join(root, 'main.js') } },
    })) as Rolldown.RolldownOutput;
    const css = out.output.filter((file) => file.fileName.endsWith('.css'));
    expect(css).toHaveLength(1);
    expect(String((css[0] as Rolldown.OutputAsset).source)).toContain('--gap:5px');
  });

  it('names a module that does not export the schema', async () => {
    const bad = await createServer({
      root,
      configFile: false,
      plugins: [weaselPrefsCss({ schemas: { './prefs.ts': 'NOPE' } })],
      server: { middlewareMode: true, ws: false },
      appType: 'custom',
      optimizeDeps: { noDiscovery: true },
      logLevel: 'silent',
    });
    try {
      await expect(bad.transformRequest('\0virtual:weasel-prefs.css')).rejects.toThrow(/prefs\.ts exports no PrefGroup named "NOPE"/);
    } finally {
      await bad.close();
    }
  });
});
