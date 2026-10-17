import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';
import { build, createServer, type Rollup } from 'vite';
import { describe, expect, it } from 'vitest';
import { weaselIcons, type WeaselIconsOptions } from './index';

const root = fileURLToPath(new URL('./fixtures/app', import.meta.url));
const iconsSrc = fileURLToPath(new URL('../../icons/src/index.ts', import.meta.url));

async function bundle(options: Partial<WeaselIconsOptions> = {}, { minify = false, entry = 'main.ts' } = {}) {
  const out = await build({
    root,
    logLevel: 'silent',
    configFile: false,
    resolve: { alias: { '@weasel-js/icons': iconsSrc } },
    plugins: [weaselIcons.vite({ mode: 'app', ...options })],
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
});
