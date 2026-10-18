// @vitest-environment node
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, createLogger, createServer, type HotPayload, type InlineConfig, type Plugin, type ViteDevServer } from 'vite';
import { afterAll, afterEach, beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest';
import type { IndexEntry } from '../story/types';
import { forge } from './plugin';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, globSync: vi.fn(actual.globSync) };
});

/** How long a poll waits for the index to follow a file written to disk.
 *  Under a loaded machine 5s has run out; the project's test timeout is 20s. */
const FOLLOWS = { timeout: 15_000, interval: 50 };

/** macOS file events for a temp directory can go missing for longer than `FOLLOWS` waits. */
const POLLED = { usePolling: true, interval: 50 };

/**
 * No test here needs prebundled dependencies, and `server.close()` resolves while rolldown is still writing them
 * under the root: removing it then fails the run with an unhandled `Failed to write file`, or rmSync with ENOTEMPTY.
 */
const NO_PREBUNDLE = { noDiscovery: true };

const story = (title: string, ...names: string[]) =>
  `export default { title: '${title}' };\n${names.map((n) => `export const ${n} = {};`).join('\n')}\n`;

// The entries import forge's and labkit's published modules, which a temp root cannot resolve.
const stubs: Plugin = {
  name: 'stub-weasel',
  enforce: 'pre',
  resolveId: (id) => (id.startsWith('@weasel-js/') ? `\0stub:${id}.js` : undefined),
  load: (id) =>
    // The side effects keep vite 8.3's bundler from dropping the shell as dead code.
    id.startsWith('\0stub:')
      ? 'export const mountWorkshop = () => { globalThis.mounted = true; return { setIndex() {} }; };\nexport const mountFrame = () => { globalThis.mounted = true; };\n'
      : undefined,
};

/** The importers module as the page asks for it. */
const IMPORTERS_URL = '/@id/__x00__virtual:forge/importers.js';

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
      server: { middlewareMode: true, watch: POLLED },
      appType: 'custom',
      optimizeDeps: NO_PREBUNDLE,
      logLevel: 'silent',
    });
    http = createHttpServer(server.middlewares);
    await new Promise<void>((done) => http.listen(0, 'localhost', done));
    port = (http.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise((done) => http?.close(done));
    await server?.close();
    rmSync(root, { recursive: true, force: true, maxRetries: 3 });
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

  it('mounts the frame with its own stylesheet', async () => {
    const code = await entry('frame-entry.js');
    expect(code).toContain('mountFrame({ index, importers, setup });');
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
    await expect.poll(async () => (await loadIndex()).length, FOLLOWS).toBe(4);
    expect((await loadIndex()).at(-1)?.id).toBe('ui-c--third');
  });

  it("titles a file whose meta names none the way Storybook does, relative to its glob's directory", async () => {
    mkdirSync(join(root, 'Button'));
    writeFileSync(join(root, 'Button', 'Button.stories.tsx'), 'export default {};\nexport const Primary = {};\n');
    const nested = await createServer({
      root,
      configFile: false,
      plugins: [forge({ stories: ['*/*.stories.tsx'] })],
      server: { middlewareMode: true, ws: false, watch: POLLED },
      appType: 'custom',
      optimizeDeps: NO_PREBUNDLE,
      logLevel: 'silent',
    });
    try {
      const index = ((await nested.ssrLoadModule('virtual:forge/index.js')) as { default: IndexEntry[] }).default;
      expect(index.map((e) => [e.id, e.title])).toEqual([['button--primary', 'Button']]);
    } finally {
      await nested.close();
    }
  });

  it('checks an added file against the globs without re-globbing the tree', async () => {
    vi.mocked(globSync).mockClear();
    writeFileSync(join(root, 'd.other.tsx'), story('ui/E', 'Unmatched'));
    writeFileSync(join(root, 'd.stories.tsx'), story('ui/D', 'Fourth'));
    await expect.poll(async () => (await loadIndex()).map((e) => e.id), FOLLOWS).toContain('ui-d--fourth');
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
    if (root) rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
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
      server: { middlewareMode: true, watch: POLLED },
      appType: 'custom',
      optimizeDeps: NO_PREBUNDLE,
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
    await expect.poll(async () => indexOf(s), FOLLOWS).toContain('ui-bad--fixed');
  });

  it("titles a native story by its meta when forge's meta reaches it through a helper module, and re-decides when the helper changes", async () => {
    const forgeEntry = join(import.meta.dirname, '../index.ts');
    const native = (from: string) =>
      `import { meta, story } from '${from}';\nexport default meta({ title: 'ui/Thing' });\nexport const Basic = story({ render: () => null });\n`;
    const { dir, server: s } = await start(
      {
        'forge-helpers.ts': `export { meta, story } from '@weasel-js/forge';\n`,
        'impostor.ts': `export const meta = (spec: object) => spec;\nexport const story = (spec: object) => spec;\n`,
        'thing.stories.tsx': native('./forge-helpers'),
        'other.stories.tsx': native('./impostor').replace('ui/Thing', 'ui/Other'),
      },
      { resolve: { alias: { '@weasel-js/forge': forgeEntry } } },
    );
    expect(await indexOf(s)).toEqual(['other--basic', 'ui-thing--basic']);
    writeFileSync(join(dir, 'forge-helpers.ts'), `export const meta = (spec: object) => spec;\nexport const story = meta;\n`);
    await expect.poll(async () => indexOf(s), FOLLOWS).toEqual(['other--basic', 'thing--basic']);
  });

  it('re-decides a story whose helper module did not exist until after it was indexed', async () => {
    const forgeEntry = join(import.meta.dirname, '../index.ts');
    const { dir, server: s } = await start(
      {
        'thing.stories.tsx': `import { meta, story } from './forge-helpers';\nexport default meta({ title: 'ui/Thing' });\nexport const Basic = story({ render: () => null });\n`,
      },
      { resolve: { alias: { '@weasel-js/forge': forgeEntry } } },
    );
    expect(await indexOf(s)).toEqual(['thing--basic']);
    writeFileSync(join(dir, 'forge-helpers.ts'), `export { meta, story } from '@weasel-js/forge';\n`);
    await expect.poll(async () => indexOf(s), FOLLOWS).toEqual(['ui-thing--basic']);
  });

  it('serves the component graph from source, and pushes it again when a component file changes', async () => {
    const { dir, server: s } = await start({
      'A.tsx': `import { B } from './B';\nexport const A = () => <B />;\n`,
      'B.tsx': `export const B = () => null;\n`,
      'a.stories.tsx': `import { A } from './A';\nexport default { title: 'ui/A', component: A };\nexport const One = {};\n`,
      'b.stories.tsx': `import { B } from './B';\nexport default { title: 'ui/B', component: B };\nexport const One = {};\n`,
    });
    const sent = vi.spyOn(s.ws, 'send');
    const graph = async () =>
      ((await s.ssrLoadModule('virtual:forge/deps.js')) as { default: Record<string, { uses: string[]; usedBy: string[] }> }).default;
    expect(await graph()).toEqual({
      'ui/A': { source: 'A.tsx', uses: ['ui/B'], usedBy: [] },
      'ui/B': { source: 'B.tsx', uses: [], usedBy: ['ui/A'] },
    });
    writeFileSync(join(dir, 'A.tsx'), `export const A = () => null;\n`);
    await expect.poll(async () => (await graph())['ui/A']?.uses, FOLLOWS).toEqual([]);
    expect(sent).toHaveBeenCalledWith(expect.objectContaining({ event: 'forge:deps' }));
  });

  // The workshop entry imports forge's and labkit's published modules, which a temp root cannot resolve.
  const served = (): InlineConfig => ({
    plugins: [stubs, forge({ stories: ['*.stories.tsx'] })],
  });

  /** Fetches what an opening workshop page fetches, which is what puts those modules in vite's graph under the page's URLs. */
  const open = async (s: ViteDevServer, ...more: string[]) => {
    const listening = createHttpServer(s.middlewares);
    http = listening;
    await new Promise<void>((done) => listening.listen(0, 'localhost', done));
    const { port } = listening.address() as AddressInfo;
    for (const url of ['/@id/virtual:forge/shell-entry.js', IMPORTERS_URL, ...more]) {
      expect((await fetch(`http://localhost:${port}${url}`)).status).toBe(200);
    }
  };

  /** Every payload the server pushes to the page from here on, forge's events and vite's updates alike. */
  const pushed = (s: ViteDevServer) => {
    const payloads: HotPayload[] = [];
    const keep = (payload: unknown) => {
      if (typeof payload === 'object' && payload !== null && !payloads.includes(payload as HotPayload)) payloads.push(payload as HotPayload);
    };
    vi.spyOn(s.ws, 'send').mockImplementation(keep);
    vi.spyOn(s.environments.client.hot, 'send').mockImplementation(keep);
    return payloads;
  };
  const storyEvents = (payloads: readonly HotPayload[]) =>
    payloads.flatMap((p) => (p.type === 'custom' && p.event === 'forge:story' ? [(p.data as { file: string }).file] : []));
  /** Where in `payloads` vite tells the workshop entry to take the importers module again; -1 when it has not. */
  const importersUpdate = (payloads: readonly HotPayload[]) =>
    payloads.findIndex((p) => p.type === 'update' && p.updates.some((u) => u.acceptedPath.endsWith('virtual:forge/importers.js')));

  /**
   * Writes `code` to `file` until the server tells the workshop entry to take the importers again. A write that
   * lands before the watcher's first scan ends is never reported, so one write is not enough on a busy machine.
   */
  const writeUntilPushed = async (payloads: readonly HotPayload[], file: string, code: string) => {
    let writes = 0;
    await expect
      .poll(() => {
        if (importersUpdate(payloads) === -1) writeFileSync(file, `${code}// ${writes++}\n`);
        return importersUpdate(payloads);
      }, { timeout: FOLLOWS.timeout, interval: 500 })
      .not.toBe(-1);
  };

  it('names the story file to reload when it changes, or a module it imports does', async () => {
    const { dir, server: s } = await start(
      {
        'rows.ts': `export const rows = [1];\n`,
        'a.stories.tsx': `import { rows } from './rows';\nexport default { title: 'ui/A' };\nexport const One = { args: { rows } };\n`,
      },
      served(),
    );
    await open(s, '/a.stories.tsx');
    const payloads = pushed(s);
    await writeUntilPushed(payloads, join(dir, 'rows.ts'), `export const rows = [1, 2];\n`);
    const named = payloads.findIndex((p) => p.type === 'custom' && p.event === 'forge:story');
    expect([...new Set(storyEvents(payloads))]).toEqual([join(dir, 'a.stories.tsx')]);
    expect(named).toBeLessThan(importersUpdate(payloads));

    payloads.length = 0;
    await writeUntilPushed(payloads, join(dir, 'a.stories.tsx'), story('ui/A', 'One'));
    expect([...new Set(storyEvents(payloads))]).toEqual([join(dir, 'a.stories.tsx')]);
  });

  it('hands the open workshop an importer for a story file added while it runs', async () => {
    const { dir, server: s } = await start({ 'a.stories.tsx': story('ui/A', 'First') }, served());
    await open(s);
    const payloads = pushed(s);
    // Written once: a second write would be a change to a file the first scan had already counted, not an add.
    writeFileSync(join(dir, 'b.stories.tsx'), story('ui/B', 'Added'));
    await expect.poll(() => importersUpdate(payloads), FOLLOWS).not.toBe(-1);
    expect((await s.transformRequest('virtual:forge/importers.js'))?.code).toContain(join(dir, 'b.stories.tsx'));
  });

  it('indexes a file added under a glob written with a leading ./', async () => {
    const { dir, server: s } = await start(
      { 'a.stories.tsx': story('ui/A', 'First') },
      { plugins: [forge({ stories: ['./*.stories.tsx'] })] },
    );
    expect(await indexOf(s)).toEqual(['ui-a--first']);
    writeFileSync(join(dir, 'b.stories.tsx'), story('ui/B', 'Added'));
    await expect.poll(async () => indexOf(s), FOLLOWS).toContain('ui-b--added');
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
    writeFileSync(join(root, 'forge.shell.ts'), `export default { title: 'Acme workshop', globals: {} };\n`);
    server = await createServer({
      root,
      configFile: false,
      plugins: [
        forge({ stories: ['*.stories.tsx'], frameConfig: 'forge.frame.ts', shellConfig: 'forge.shell.ts', frameStyles: ['frame.css'] }),
      ],
      server: { middlewareMode: true, watch: POLLED },
      appType: 'custom',
      optimizeDeps: NO_PREBUNDLE,
      logLevel: 'silent',
    });
  });

  afterAll(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });

  const entry = async (name: string) => (await server.pluginContainer.load(`\0virtual:forge/${name}`)) as string;
  const loadDefault = async (id: string) => ((await server.ssrLoadModule(id)) as { default: unknown }).default;

  it('serves each config module as its own virtual module', async () => {
    expect(await loadDefault('virtual:forge/frame-config.js')).toEqual({ parameters: { layout: 'centered' } });
    expect(await loadDefault('virtual:forge/shell-config.js')).toEqual({ title: 'Acme workshop', globals: {} });
  });

  it('imports the shell config only from the workshop entry, and the frame config from both', async () => {
    const shell = await entry('shell-entry.js');
    const frame = await entry('frame-entry.js');
    expect(shell).toContain('virtual:forge/shell-config.js');
    expect(shell).toContain('virtual:forge/frame-config.js');
    expect(shell).toContain('virtual:forge/importers.js');
    expect(frame).toContain('virtual:forge/frame-config.js');
    expect(frame).not.toContain('shell-config');
  });

  it("titles the served documents with the shell config's title, before any script has run", async () => {
    const http = createHttpServer(server.middlewares);
    await new Promise<void>((done) => http.listen(0, 'localhost', done));
    const page = async (path: string) => (await fetch(`http://localhost:${(http.address() as AddressInfo).port}${path}`)).text();
    onTestFinished(() => new Promise<void>((done) => void http.close(() => done())));
    expect(await page('/')).toContain('<title>Acme workshop</title>');
    expect(await page('/frame.html')).toContain('<title>Acme workshop</title>');
  });

  it('imports a frame stylesheet from the frame entry alone', async () => {
    const sheet = `import ${JSON.stringify(join(root, 'frame.css'))};`;
    expect(await entry('frame-entry.js')).toContain(sheet);
    expect(await entry('shell-entry.js')).not.toContain('frame.css');
  });

  it('accepts a story edit in both entries: the workshop reloads the story, a frame reloads itself', async () => {
    const shell = await entry('shell-entry.js');
    const frame = await entry('frame-entry.js');
    expect(shell).toContain(`import.meta.hot?.on('forge:story'`);
    expect(shell).toContain(`import.meta.hot?.accept('virtual:forge/importers.js'`);
    expect(shell).toContain('workshop.reloadStory(file)');
    expect(frame).toContain(`import.meta.hot?.accept('virtual:forge/importers.js', () => location.reload())`);
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
      server: { middlewareMode: true, watch: POLLED },
      appType: 'custom',
      optimizeDeps: NO_PREBUNDLE,
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
    if (root) rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    root = undefined;
  });

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
