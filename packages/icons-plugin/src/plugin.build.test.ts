import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';
import { build, createServer, type Plugin, type Rollup, type ViteDevServer } from 'vite';
import { describe, expect, it } from 'vitest';
import { weaselIcons, type WeaselIconsOptions } from './index';

const root = fileURLToPath(new URL('./fixtures/app', import.meta.url));
const iconsSrc = fileURLToPath(new URL('../../icons/src/index.ts', import.meta.url));

async function bundle(
  options: Partial<WeaselIconsOptions> = {},
  { minify = false, entry = 'main.ts', alias = {} as Record<string, string>, mode = 'production', before = [] as Plugin[] } = {},
) {
  const out = await build({
    root,
    mode,
    logLevel: 'silent',
    configFile: false,
    resolve: { alias: { '@weasel-js/icons': iconsSrc, ...alias } },
    plugins: [...before, weaselIcons.vite({ mode: 'app', ...options })],
    build: { write: false, minify, rollupOptions: { input: `${root}/src/${entry}` } },
  });
  const chunks = (Array.isArray(out) ? out[0]! : (out as Rollup.RollupOutput)).output.filter(
    (o): o is Rollup.OutputChunk => o.type === 'chunk',
  );
  const holding = (id: string) => {
    const chunk = chunks.find((c) => c.moduleIds.includes(id));
    if (!chunk) throw new Error(`no chunk holds ${id}`);
    return chunk.code;
  };
  return {
    entry: chunks.find((c) => c.isEntry)!.code,
    variant: (name: string) => holding(`\0virtual:weasel-icons/${name}`),
    all: chunks.map((c) => c.code).join('\n'),
  };
}

describe('weaselIcons app mode', () => {
  it('ships exactly the glyphs the build names', async () => {
    const { entry } = await bundle();
    expect(entry).toContain('fx-dot-body');
    expect(entry).toContain('lib-star-body');
    expect(entry).not.toContain('fx-ring-body');
    expect(entry).not.toContain('lib-moon-body');
  });

  it('follows an icons.gen import the bundler resolves through an alias', async () => {
    const { entry } = await bundle({}, { entry: 'aliased.ts', alias: { '#gen': `${root}/src` } });
    expect(entry).toContain('fx-ring-body');
    expect(entry).not.toContain('fx-dot-body');
  });

  it('survives minification', async () => {
    const { entry, all } = await bundle({}, { minify: true });
    expect(entry).toContain('lib-star-body');
    expect(all).not.toContain('__WEASEL_ICONS__');
  });

  it('builds the all variant as its own chunk with every glyph', async () => {
    const { variant } = await bundle();
    const all = variant('all');
    for (const body of ['fx-dot-body', 'fx-ring-body', 'lib-star-body', 'lib-moon-body']) expect(all).toContain(body);
  });

  it('filters a custom variant by tag', async () => {
    const round = (await bundle({ variants: { round: { tags: ['round'] } } }, { entry: 'round.ts' })).variant('round');
    expect(round).toContain('fx-ring-body');
    expect(round).not.toContain('fx-dot-body');
    expect(round).not.toContain('lib-star-body');
  });

  it('builds a namespace variant with that namespace whole', async () => {
    const lib = (await bundle({}, { entry: 'ns.ts' })).variant('lib');
    expect(lib).toContain('lib-star-body');
    expect(lib).toContain('lib-moon-body');
    expect(lib).not.toContain('fx-dot-body');
  });

  it('fails on a namespace no package provides, naming the module', async () => {
    await expect(bundle({}, { entry: 'missing.ts' })).rejects.toThrow(
      /no package in this build provides the icon namespace "gone".*missing\.ts/s,
    );
  });

  it('fails on a name missing from its namespace, naming the module', async () => {
    await expect(bundle({}, { entry: 'unknown.ts' })).rejects.toThrow(/icon "lib:nope" is not in @fx\/lib's table.*unknown\.ts/s);
  });

  it('trims and checks a build run under --mode test as any other build', async () => {
    const { entry } = await bundle({}, { mode: 'test' });
    expect(entry).not.toContain('fx-ring-body');
    await expect(bundle({}, { entry: 'unknown.ts', mode: 'test' })).rejects.toThrow(/icon "lib:nope" is not in/);
  });

  it('reads a module another plugin compiles to JS, such as a single-file component', async () => {
    const sfc: Plugin = {
      name: 'fake-sfc',
      transform: (code, id) => (id.endsWith('.sfc') ? code.replace(/<\/?script>/g, '') : null),
    };
    const { entry } = await bundle({}, { entry: 'sfc.ts', before: [sfc] });
    expect(entry).toContain('fx-ring-body');
    expect(entry).not.toContain('fx-dot-body');
  });

  it('forgets the previous build when one plugin builds again, as under --watch', async () => {
    const plugin = weaselIcons.vite({ mode: 'app' });
    const entryOf = async (entry: string) => {
      const out = await build({
        root,
        logLevel: 'silent',
        configFile: false,
        resolve: { alias: { '@weasel-js/icons': iconsSrc } },
        plugins: [plugin],
        build: { write: false, minify: false, rollupOptions: { input: `${root}/src/${entry}` } },
      });
      const result = Array.isArray(out) ? out[0]! : (out as Rollup.RollupOutput);
      return result.output.find((o): o is Rollup.OutputChunk => o.type === 'chunk' && o.isEntry)!.code;
    };
    expect(await entryOf('main.ts')).toContain('lib-star-body');
    const second = await entryOf('consumer.ts');
    expect(second).toContain('fx-ring-body');
    expect(second).not.toContain('lib-star-body');
  });

  it('forgets the refs of a compiled module that stops naming icons on a rebuild', async () => {
    const plugin = weaselIcons.vite({ mode: 'app' });
    let named = true;
    const sfc: Plugin = {
      name: 'fake-sfc',
      transform: (code, id) => (!id.endsWith('.sfc') ? null : named ? code.replace(/<\/?script>/g, '') : `export const ring = 'ring';`),
    };
    const entryOf = async () => {
      const out = await build({
        root,
        logLevel: 'silent',
        configFile: false,
        resolve: { alias: { '@weasel-js/icons': iconsSrc } },
        plugins: [sfc, plugin],
        build: { write: false, minify: false, rollupOptions: { input: `${root}/src/sfc.ts` } },
      });
      const result = Array.isArray(out) ? out[0]! : (out as Rollup.RollupOutput);
      return result.output.find((o): o is Rollup.OutputChunk => o.type === 'chunk' && o.isEntry)!.code;
    };
    expect(await entryOf()).toContain('fx-ring-body');
    named = false;
    expect(await entryOf()).not.toContain('fx-ring-body');
  });

  it('refuses a custom variant named all when constructed', () => {
    expect(() => weaselIcons.vite({ mode: 'app', variants: { all: {} } })).toThrow(/cannot be named "all"/);
  });

  it('fails when a custom variant takes the name of a namespace it finds', async () => {
    await expect(bundle({ variants: { lib: { tags: ['round'] } } })).rejects.toThrow(/custom icon variant "lib"/);
  });
});

describe('weaselIcons in dev', () => {
  it('serves every table whole before any module importing icons.gen is transformed', async () => {
    const server = await createServer({
      root,
      logLevel: 'silent',
      configFile: false,
      appType: 'custom',
      server: { middlewareMode: true, hmr: false, ws: false },
      optimizeDeps: { noDiscovery: true, include: [] },
      resolve: { alias: { '@weasel-js/icons': iconsSrc } },
      plugins: [weaselIcons.vite({ mode: 'app' })],
    });
    try {
      type Tables = { default: { namespace: string; icons: Record<string, unknown> }[] };
      const used = (await server.ssrLoadModule('virtual:weasel-icons')) as Tables;
      const fx = used.default.find((t) => t.namespace === 'fx');
      expect(Object.keys(fx?.icons ?? {}).sort()).toEqual(['dot', 'ring']);
      expect(used.default.some((t) => t.namespace === 'lib')).toBe(true);
      const own = (await server.ssrLoadModule('virtual:weasel-icons/fx')) as Tables;
      expect(own.default.map((t) => t.namespace)).toEqual(['fx']);
    } finally {
      await server.close();
    }
  });

  it('passes over a table change whose directory is already gone', async () => {
    const server = await createServer({
      root,
      logLevel: 'silent',
      configFile: false,
      appType: 'custom',
      server: { middlewareMode: true, hmr: false, ws: false },
      optimizeDeps: { noDiscovery: true, include: [] },
      resolve: { alias: { '@weasel-js/icons': iconsSrc } },
      plugins: [weaselIcons.vite({ mode: 'app' })],
    });
    try {
      const gone = join(tmpdir(), 'weasel-icons-gone', String(Date.now()), 'icons.table.json');
      expect(() => server.watcher.emit('change', gone)).not.toThrow();
    } finally {
      await server.close();
    }
  });
});

describe('weaselIcons in dev, as tables change', () => {
  const gen = `import { scopedIcon } from '@weasel-js/icons';\nexport const icon = scopedIcon('late');\n`;
  const table = (...names: string[]) =>
    JSON.stringify({
      namespace: 'late',
      owner: 'late-pkg',
      icons: Object.fromEntries(names.map((n) => [n, { body: `<path data-id="late-${n}"/>`, group: 'Marks', tags: [] }])),
    });
  type Tables = { default: { namespace: string; icons: Record<string, unknown> }[] };
  const glyphs = async (server: ViteDevServer) =>
    ((await server.ssrLoadModule('virtual:weasel-icons')) as Tables).default.find((t) => t.namespace === 'late')?.icons;

  it('serves a table a transform finds, and a glyph added to it, without a restart', async () => {
    // Beside the app's root rather than under it, so only a transform can find the table.
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'weasel-icons-dev-')));
    const app = join(dir, 'app');
    const lib = join(dir, 'lib');
    mkdirSync(app);
    mkdirSync(lib);
    writeFileSync(join(lib, 'icons.gen.ts'), gen);
    writeFileSync(join(lib, 'icons.table.json'), table('a'));
    writeFileSync(join(app, 'main.ts'), `import { icon } from '../lib/icons.gen';\nexport const a = icon('a');\n`);
    const server = await createServer({
      root: app,
      logLevel: 'silent',
      configFile: false,
      appType: 'custom',
      server: { middlewareMode: true, hmr: false, ws: false, fs: { allow: [dir] } },
      optimizeDeps: { noDiscovery: true, include: [] },
      resolve: { alias: { '@weasel-js/icons': iconsSrc } },
      plugins: [weaselIcons.vite({ mode: 'app' })],
    });
    try {
      expect(await glyphs(server)).toBeUndefined();
      await server.ssrLoadModule(join(app, 'main.ts'));
      expect(Object.keys((await glyphs(server)) ?? {})).toEqual(['a']);
      writeFileSync(join(lib, 'icons.table.json'), table('a', 'b'));
      server.watcher.emit('change', join(lib, 'icons.table.json'));
      expect(Object.keys((await glyphs(server)) ?? {}).sort()).toEqual(['a', 'b']);
    } finally {
      await server.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('weaselIcons library mode', () => {
  it('leaves an annotated qualified literal in esbuild output', async () => {
    const out = await esbuild({
      entryPoints: [`${root}/src/widget.ts`],
      bundle: true,
      write: false,
      format: 'esm',
      external: ['@weasel-js/icons'],
      plugins: [weaselIcons.esbuild({ mode: 'library' })],
    });
    expect(out.outputFiles[0]!.text).toMatch(/\/\* @icon \*\/\s*"fx:ring"/);
  });

  it('refuses an esbuild build that minifies away the annotations', async () => {
    for (const minify of [{ minify: true }, { minifyWhitespace: true }]) {
      await expect(
        esbuild({
          entryPoints: [`${root}/src/widget.ts`],
          bundle: true,
          write: false,
          format: 'esm',
          logLevel: 'silent',
          external: ['@weasel-js/icons'],
          plugins: [weaselIcons.esbuild({ mode: 'library' })],
          ...minify,
        }),
      ).rejects.toThrow(/@icon annotation.*minify/s);
    }
  });
});
