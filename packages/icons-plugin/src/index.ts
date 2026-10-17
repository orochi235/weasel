import MagicString from 'magic-string';
import { createUnplugin, type UnpluginInstance } from 'unplugin';
import { libraryAnnotations } from './annotate';
import type { IconTable } from '@weasel-js/icons';
// Relative, and so bundled in: vite and tsup configs load this from source, before any dist exists.
import { splitIconRef } from '../../icons/src/names';
import { collectIconRefs } from './collect';
import { rewriteIconCalls } from './rewrite';
import { declaredTable, genFile, namespaceIn, packageDirFinder, reachableTables, tableBeside } from './tables';
import { MARKER, PREFIX, USED, admits, moduleFor, subset, variantOf, type VariantFilter } from './virtual';

export type { VariantFilter } from './virtual';
export { collectIconRefs } from './collect';

/** How {@link weaselIcons} treats the build it runs in. */
export interface WeaselIconsOptions {
  /**
   * `library` only rewrites `icon()` calls; `app` also emits `virtual:weasel-icons` and its variants,
   * and needs vite, rollup or rolldown, since esbuild has no hook to fill them in once every module is seen.
   */
  mode: 'library' | 'app';
  /** Extra variants, each loadable as `virtual:weasel-icons/<name>`. */
  variants?: Record<string, VariantFilter>;
}

const SOURCE = /\.[cm]?[jt]sx?$/;

/** Report through the bundler when its context can, and throw in case it only records. */
function fail(ctx: object, message: string): never {
  if ('error' in ctx && typeof ctx.error === 'function') ctx.error(message);
  throw new Error(message);
}

/**
 * Rewrites each `icon('x')` imported from a generated `icons.gen` into an annotated, qualified
 * literal. In `app` mode it also emits `virtual:weasel-icons`, holding only the glyphs the build
 * names, plus `/all`, `/<namespace>` and each custom variant, every one its own chunk.
 */
export const weaselIcons: UnpluginInstance<WeaselIconsOptions, false> = createUnplugin((options: WeaselIconsOptions, meta) => {
  if (options.mode === 'app' && meta.framework === 'esbuild') {
    throw new Error("weaselIcons: app mode needs vite, rollup or rolldown; under esbuild its placeholders would ship unfilled");
  }
  const variants = options.variants ?? {};
  for (const name of Object.keys(variants)) {
    if (name === 'all' || name === '') throw new Error(`weaselIcons: a custom variant cannot be named "${name}"`);
  }
  const app = options.mode === 'app';
  const refs = new Map<string, string>();
  const tables = new Map<string, IconTable>();
  const packageDir = packageDirFinder();
  const seenPackages = new Set<string>();
  const library = libraryAnnotations();
  let dev = false;

  const addTable = (ctx: object, table: IconTable) => {
    const held = tables.get(table.namespace);
    if (held && held.owner !== table.owner) {
      fail(ctx, `the icon namespace "${table.namespace}" is claimed by both ${held.owner} and ${table.owner}`);
    }
    if (table.namespace in variants) {
      fail(ctx, `the custom icon variant "${table.namespace}" has the name of ${table.owner}'s icon namespace`);
    }
    tables.set(table.namespace, held ? { ...table, icons: { ...held.icons, ...table.icons } } : table);
  };
  const variantTables = (ctx: object, variant: string): IconTable[] => {
    const all = [...tables.values()];
    if (variant === USED) return dev ? all : subset(all, (ns, name) => refs.has(`${ns}:${name}`));
    if (variant === 'all') return all;
    const custom = variants[variant];
    if (custom) return subset(all, admits(custom));
    const own = tables.get(variant);
    if (!own) fail(ctx, `virtual:weasel-icons/${variant} names no custom variant and no icon namespace in this build`);
    return [own];
  };
  const checkRefs = (ctx: object) => {
    for (const [ref, from] of refs) {
      const parts = splitIconRef(ref);
      const table = parts && tables.get(parts.namespace);
      if (!parts || !table) fail(ctx, `no package in this build provides the icon namespace "${parts?.namespace ?? ref}" (named in ${from})`);
      if (!table.icons[parts.name]) fail(ctx, `icon "${ref}" is not in ${table.owner}'s table (named in ${from})`);
    }
  };
  // Runs after every module is transformed, so `refs` and `tables` are complete.
  function renderChunk(this: object, code: string, chunk: { fileName: string; moduleIds: readonly string[] }) {
    if (!app) return library.renderChunk(code, chunk);
    if (!code.includes('__WEASEL_ICONS__')) return null;
    const s = new MagicString(code);
    for (const m of code.matchAll(MARKER)) {
      const json = JSON.stringify(JSON.stringify(variantTables(this, m[2]!)));
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
    transform(code, id) {
      const file = id.split('?')[0]!;
      const out = rewriteIconCalls(
        code,
        file,
        (spec) => {
          const gen = genFile(spec, file);
          if (!gen) return undefined;
          const table = app ? tableBeside(gen) : undefined;
          if (table) addTable(this, table);
          return namespaceIn(gen);
        },
        (message) => this.warn(message),
      );
      if (out && out.dynamic > 0) {
        this.warn(`${file}: ${out.dynamic} icon() call(s) with a computed name resolve only from a loaded variant`);
      }
      if (!app) {
        library.record(id, collectIconRefs(out?.code ?? code, file));
      } else {
        const dir = packageDir(file);
        if (dir && !seenPackages.has(dir)) {
          seenPackages.add(dir);
          const table = declaredTable(dir);
          if (table) addTable(this, table);
        }
        for (const ref of collectIconRefs(out?.code ?? code, file)) if (!refs.has(ref)) refs.set(ref, file);
      }
      return out ? { code: out.code, map: out.map } : null;
    },
    resolveId: (id) => (app && (id === PREFIX || id.startsWith(PREFIX + '/')) ? '\0' + id : null),
    loadInclude: (id) => variantOf(id) !== undefined,
    load(id) {
      const variant = variantOf(id);
      if (variant === undefined) return null;
      return dev ? `export default ${JSON.stringify(variantTables(this, variant))};` : moduleFor(variant);
    },
    buildEnd() {
      if (app && !dev) checkRefs(this);
    },
    vite: {
      configResolved(config) {
        dev = config.command === 'serve' || config.mode === 'test';
        if (app && dev) for (const t of reachableTables(config.root)) addTable(this, t);
      },
      renderChunk: lastRenderChunk,
      generateBundle,
    },
    rollup: { renderChunk: lastRenderChunk, generateBundle },
    rolldown: { renderChunk: lastRenderChunk, generateBundle },
  };
});
