import { existsSync } from 'node:fs';
import MagicString from 'magic-string';
import { createUnplugin, type UnpluginInstance } from 'unplugin';
import { libraryAnnotations } from './annotate.ts';
import { assertBundler } from './bundlers.ts';
import { fail, iconCatalog, tablesFrom } from './catalog.ts';
import { collectIconRefs } from './collect.ts';
import { rewriteIconCalls } from './rewrite.ts';
import { genFile, namespaceIn, packageDirFinder, reachableTables } from './tables.ts';
import { MARKER, PREFIX, markedVariant, moduleFor, variantOf, type VariantFilter } from './virtual.ts';

export type { VariantFilter } from './virtual.ts';
export { collectIconRefs } from './collect.ts';

/** How {@link weaselIcons} treats the build it runs in. */
export interface WeaselIconsOptions {
  /**
   * `library` only rewrites `icon()` calls, under vite, rollup, rolldown or esbuild. `app` also emits
   * `virtual:weasel-icons` and its variants, and needs vite, rollup or rolldown: the others have no
   * hook to fill them in once every module is seen.
   */
  mode: 'library' | 'app';
  /** Extra variants, each loadable as `virtual:weasel-icons/<name>`. */
  variants?: Record<string, VariantFilter>;
}

const SOURCE = /\.[cm]?[jt]sx?$/;
const GEN_SPECIFIER = /(['"])([^'"\n]*icons\.gen(?:\.[cm]?[jt]sx?)?)\1/g;

/** The icons.gen file each specifier in `code` names: relative ones from disk, the rest, such as a path alias, through the bundler. */
async function genFiles(ctx: object, code: string, file: string, id: string): Promise<Map<string, string | undefined>> {
  const out = new Map<string, string | undefined>();
  if (!code.includes('icons.gen')) return out;
  type Resolve = (spec: string, importer: string) => Promise<{ id: string; external?: unknown } | null>;
  const resolve = 'resolve' in ctx && typeof ctx.resolve === 'function' ? (ctx.resolve as Resolve) : undefined;
  for (const m of code.matchAll(GEN_SPECIFIER)) {
    const spec = m[2]!;
    if (out.has(spec)) continue;
    let gen = genFile(spec, file);
    if (!gen && resolve && !spec.startsWith('.')) {
      const hit = await resolve.call(ctx, spec, id).catch(() => null);
      const path = hit && !hit.external ? hit.id.split('?')[0]! : undefined;
      gen = path && SOURCE.test(path) && existsSync(path) ? path : undefined;
    }
    out.set(spec, gen);
  }
  return out;
}

/** The ids of every module in the build, when the bundler's context can list them. */
function liveModules(ctx: object): Set<string> | undefined {
  if (!('getModuleIds' in ctx) || typeof ctx.getModuleIds !== 'function') return undefined;
  return new Set(ctx.getModuleIds() as Iterable<string>);
}

/**
 * Rewrites each `icon('x')` imported from a generated `icons.gen` into an annotated, qualified
 * literal. In `app` mode it also emits `virtual:weasel-icons`, holding only the glyphs the build
 * names, plus `/all`, `/<namespace>` and each custom variant, every one its own chunk.
 */
export const weaselIcons: UnpluginInstance<WeaselIconsOptions, false> = createUnplugin((options: WeaselIconsOptions, meta) => {
  assertBundler(options.mode, meta.framework);
  const variants = options.variants ?? {};
  for (const name of Object.keys(variants)) {
    if (name === 'all' || name === '') throw new Error(`weaselIcons: a custom variant cannot be named "${name}"`);
  }
  const app = options.mode === 'app';
  const catalog = iconCatalog(variants);
  const packageDir = packageDirFinder();
  const seenPackages = new Set<string>();
  const library = libraryAnnotations();
  let dev = false;

  // Runs after every module is transformed, so `refs` and `tables` are complete.
  function renderChunk(this: object, code: string, chunk: { fileName: string }) {
    if (!app) return library.renderChunk(code, chunk);
    if (!code.includes('__WEASEL_ICONS__')) return null;
    const s = new MagicString(code);
    for (const m of code.matchAll(MARKER)) {
      const json = JSON.stringify(JSON.stringify(catalog.variant(this, markedVariant(m), dev)));
      s.overwrite(m.index!, m.index! + m[0].length, json);
    }
    // A string map: magic-string's object form types `sourcesContent` wider than rollup accepts.
    return { code: s.toString(), map: s.generateMap({ hires: true }).toString() };
  }
  // After the bundler's own renderChunk work, which drops plain comments. rolldown's output
  // minify, even its default dead-code pass, runs later still and drops them again.
  const lastRenderChunk = { order: 'post' as const, handler: renderChunk };
  function generateBundle(this: object, _: unknown, bundle: Record<string, { type: string; code?: string }>) {
    const stripped = app ? undefined : library.stripped(bundle);
    if (stripped) fail(this, stripped);
  }

  return {
    name: 'weasel-icons',
    enforce: 'pre',
    transformInclude: (id) => !id.startsWith('\0') && SOURCE.test(id.split('?')[0]!),
    async transform(code, id) {
      const file = id.split('?')[0]!;
      const gens: string[] = [];
      const found = await genFiles(this, code, file, id);
      const out = rewriteIconCalls(
        code,
        file,
        (spec) => {
          const gen = found.get(spec) ?? genFile(spec, file);
          if (gen) gens.push(gen);
          return gen && namespaceIn(gen);
        },
        (message) => this.warn(message),
      );
      if (out && out.dynamic > 0) {
        this.warn(`${file}: ${out.dynamic} icon() call(s) with a computed name resolve only from a loaded variant`);
      }
      const named = collectIconRefs(out?.code ?? code, file);
      if (!app) {
        library.record(id, named);
      } else {
        const pkg = packageDir(file);
        if (!dev) {
          catalog.record(id, { file, gens, pkg, refs: named });
        } else {
          const fresh = pkg && !seenPackages.has(pkg) ? [pkg] : [];
          fresh.forEach((d) => seenPackages.add(d));
          for (const t of tablesFrom(gens, fresh)) catalog.add(this, t);
        }
      }
      return out ? { code: out.code, map: out.map } : null;
    },
    resolveId: (id) => (app && (id === PREFIX || id.startsWith(PREFIX + '/')) ? '\0' + id : null),
    loadInclude: (id) => variantOf(id) !== undefined,
    load(id) {
      const variant = variantOf(id);
      if (variant === undefined) return null;
      return dev ? `export default ${JSON.stringify(catalog.variant(this, variant, dev))};` : moduleFor(variant);
    },
    buildEnd() {
      if (dev) return;
      const live = liveModules(this);
      if (live) {
        catalog.keep(live);
        library.keep(live);
      }
      if (app) catalog.settle(this);
    },
    vite: {
      configResolved(config) {
        dev = config.command === 'serve' || config.mode === 'test';
        if (app && dev) for (const t of reachableTables(config.root)) catalog.add(this, t);
      },
      renderChunk: lastRenderChunk,
      generateBundle,
    },
    rollup: { renderChunk: lastRenderChunk, generateBundle },
    rolldown: { renderChunk: lastRenderChunk, generateBundle },
  };
});
