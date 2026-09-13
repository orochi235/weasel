// @vitest-environment node
import { existsSync, globSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, createLogger, createServer, type InlineConfig, type Plugin, type ViteDevServer } from 'vite';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { IndexEntry } from '../story/types';
import { forge } from './plugin';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, globSync: vi.fn(actual.globSync) };
});

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

  const entry = async (name: string) => (await server.pluginContainer.load(`\0virtual:forge/${name}`)) as string;

  it('mounts the frame with the vite root and its own stylesheet', async () => {
    const code = await entry('frame-entry.js');
    expect(code).toContain(`root: ${JSON.stringify(root)}`);
    expect(code).toContain(`import '@weasel-js/forge/frame.css';`);
    expect(code).not.toContain('loadNativeModule');
  });

  it('mounts the workshop with a frame url under base and the story globs', async () => {
    const code = await entry('shell-entry.js');
    expect(code).toContain('frameUrl: "/frame.html"');
    expect(code).toContain('stories: ["*.stories.tsx"]');
    expect(code).toContain(`import '@weasel-js/labkit/styles.css';`);
    expect(code).toContain(`import '@weasel-js/forge/shell.css';`);
  });

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

  it('checks an added file against the globs without re-globbing the tree', async () => {
    vi.mocked(globSync).mockClear();
    writeFileSync(join(root, 'd.other.tsx'), story('ui/E', 'Unmatched'));
    writeFileSync(join(root, 'd.stories.tsx'), story('ui/D', 'Fourth'));
    await expect.poll(async () => (await loadIndex()).map((e) => e.id), { timeout: 5000, interval: 50 }).toContain('ui-d--fourth');
    expect((await loadIndex()).map((e) => e.id)).not.toContain('ui-e--unmatched');
    expect(globSync).not.toHaveBeenCalled();
  });
});

describe('forge vite plugin, served apart from the shared fixture', () => {
  let root: string | undefined;
  let server: ViteDevServer | undefined;
  let http: Server | undefined;

  afterEach(async () => {
    if (http) await new Promise((done) => http?.close(done));
    await server?.close();
    if (root) rmSync(root, { recursive: true, force: true });
    http = undefined;
    server = undefined;
    root = undefined;
  });

  const start = async (files: Record<string, string>, config: InlineConfig = {}) => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'forge-plugin-')));
    root = dir;
    for (const [name, code] of Object.entries(files)) writeFileSync(join(dir, name), code);
    server = await createServer({
      root: dir,
      configFile: false,
      plugins: [forge({ stories: ['*.stories.tsx'] })],
      server: { middlewareMode: true },
      appType: 'custom',
      logLevel: 'silent',
      ...config,
    });
    return { dir, server };
  };

  const indexOf = async (s: ViteDevServer) =>
    ((await s.ssrLoadModule('virtual:forge/index.js')) as { default: IndexEntry[] }).default.map((e) => e.id);

  it('logs and skips a story file that fails to parse at startup, and indexes it once fixed', async () => {
    const errors: string[] = [];
    const customLogger = createLogger('silent');
    customLogger.error = (msg) => {
      errors.push(msg);
    };
    const { dir, server: s } = await start(
      { 'a.stories.tsx': story('ui/A', 'First'), 'bad.stories.tsx': 'export default {' },
      { customLogger },
    );
    expect(await indexOf(s)).toEqual(['ui-a--first']);
    expect(errors.join('\n')).toContain(join(dir, 'bad.stories.tsx'));
    writeFileSync(join(dir, 'bad.stories.tsx'), story('ui/Bad', 'Fixed'));
    await expect.poll(async () => indexOf(s), { timeout: 5000, interval: 50 }).toContain('ui-bad--fixed');
  });

  it('serves the workshop at its base with or without the trailing slash', async () => {
    const { server: s } = await start({}, { base: '/x/' });
    const listening = createHttpServer(s.middlewares);
    http = listening;
    await new Promise<void>((done) => listening.listen(0, 'localhost', done));
    const at = (path: string) =>
      fetch(`http://localhost:${(listening.address() as AddressInfo).port}${path}`).then((r) => (r.status === 200 ? r.text() : null));
    expect(await at('/x')).toContain('virtual:forge/shell-entry.js');
    expect(await at('/x/')).toContain('virtual:forge/shell-entry.js');
    expect(await at('/x/frame.html')).toContain('virtual:forge/frame-entry.js');
  });
});

describe('forge vite plugin, with a config module per realm', () => {
  let root: string;
  let server: ViteDevServer;

  beforeAll(async () => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'forge-config-')));
    writeFileSync(join(root, 'a.stories.tsx'), story('ui/A', 'First'));
    writeFileSync(join(root, 'forge.frame.ts'), `export default { parameters: { layout: 'centered' } };\n`);
    writeFileSync(join(root, 'forge.shell.ts'), `export default { globals: {} };\n`);
    server = await createServer({
      root,
      configFile: false,
      plugins: [forge({ stories: ['*.stories.tsx'], frameConfig: 'forge.frame.ts', shellConfig: 'forge.shell.ts' })],
      server: { middlewareMode: true },
      appType: 'custom',
      logLevel: 'silent',
    });
  });

  afterAll(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  });

  const entry = async (name: string) => (await server.pluginContainer.load(`\0virtual:forge/${name}`)) as string;
  const loadDefault = async (id: string) => ((await server.ssrLoadModule(id)) as { default: unknown }).default;

  it('serves each config module as its own virtual module', async () => {
    expect(await loadDefault('virtual:forge/frame-config.js')).toEqual({ parameters: { layout: 'centered' } });
    expect(await loadDefault('virtual:forge/shell-config.js')).toEqual({ globals: {} });
  });

  it('imports each config module only from its own entry', async () => {
    const shell = await entry('shell-entry.js');
    const frame = await entry('frame-entry.js');
    expect(shell).toContain('virtual:forge/shell-config.js');
    expect(shell).not.toContain('frame-config');
    expect(frame).toContain('virtual:forge/frame-config.js');
    expect(frame).not.toContain('shell-config');
  });

  it('adds the story globs, both config modules and its own entry modules to the dependency scan', () => {
    const entries = server.config.optimizeDeps.entries as string[];
    expect(entries).toEqual(
      expect.arrayContaining(['*.stories.tsx', join(root, 'forge.frame.ts'), join(root, 'forge.shell.ts')]),
    );
    const own = entries.filter((e) => /[/\\](shell|frame)[/\\]index\.(ts|js)$/.test(e));
    expect(own).toHaveLength(2);
    for (const file of own) expect(existsSync(file)).toBe(true);
  });

  it('serves an empty config for a realm with no module', async () => {
    const bare = await createServer({
      root,
      configFile: false,
      plugins: [forge({ stories: ['*.stories.tsx'] })],
      server: { middlewareMode: true },
      appType: 'custom',
      logLevel: 'silent',
    });
    try {
      expect(((await bare.ssrLoadModule('virtual:forge/frame-config.js')) as { default: unknown }).default).toEqual({});
      expect(((await bare.ssrLoadModule('virtual:forge/shell-config.js')) as { default: unknown }).default).toEqual({});
    } finally {
      await bare.close();
    }
  });
});

describe('forge vite plugin, built', () => {
  let root: string | undefined;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  // The entries import forge's and labkit's published modules, which a temp root cannot resolve.
  const stubs: Plugin = {
    name: 'stub-weasel',
    enforce: 'pre',
    resolveId: (id) => (id.startsWith('@weasel-js/') ? `\0stub:${id}.js` : undefined),
    load: (id) =>
      id.startsWith('\0stub:') ? 'export const mountWorkshop = () => ({ setIndex() {} });\nexport const mountFrame = () => {};\n' : undefined,
  };

  it('writes the workshop and frame documents at the output root, loading bundles under base', async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'forge-build-')));
    root = dir;
    writeFileSync(join(dir, 'a.stories.tsx'), story('ui/A', 'First'));
    const out = join(dir, 'out');
    await build({
      root: dir,
      base: '/x/',
      configFile: false,
      logLevel: 'silent',
      plugins: [stubs, forge({ stories: ['*.stories.tsx'] })],
      build: { outDir: out },
    });
    expect(existsSync(join(out, 'node_modules'))).toBe(false);
    const index = readFileSync(join(out, 'index.html'), 'utf8');
    const frame = readFileSync(join(out, 'frame.html'), 'utf8');
    expect(index).toMatch(/<script type="module"[^>]* src="\/x\/assets\/[^"]+\.js"/);
    expect(frame).toMatch(/<script type="module"[^>]* src="\/x\/assets\/[^"]+\.js"/);
    expect(index).not.toContain('virtual:forge');
    const shell = readFileSync(join(out, index.match(/src="\/x\/([^"]+)"/)![1]!), 'utf8');
    expect(shell).toContain('/x/frame.html');
  });

  it('keeps a relative base relative to the documents at the output root', async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'forge-build-')));
    root = dir;
    writeFileSync(join(dir, 'a.stories.tsx'), story('ui/A', 'First'));
    const out = join(dir, 'out');
    await build({
      root: dir,
      base: './',
      configFile: false,
      logLevel: 'silent',
      plugins: [stubs, forge({ stories: ['*.stories.tsx'] })],
      build: { outDir: out },
    });
    const index = readFileSync(join(out, 'index.html'), 'utf8');
    const src = index.match(/<script type="module"[^>]* src="([^"]+)"/)![1]!;
    expect(existsSync(join(out, src))).toBe(true);
  });
});
