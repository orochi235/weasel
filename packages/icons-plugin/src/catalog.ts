import type { IconTable } from '@weasel-js/icons';
// Relative, and so bundled in: vite and tsup configs load this from source, before any dist exists.
import { splitIconRef } from '../../icons/src/names.ts';
import { declaredTable, tableBeside } from './tables.ts';
import { USED, admits, subset, type VariantFilter } from './virtual.ts';

/** What one transformed module read. */
export interface ModuleUse {
  readonly file: string;
  /** The icons.gen modules it imports. */
  readonly gens: readonly string[];
  readonly pkg: string | undefined;
  readonly refs: readonly string[];
}

/** Report through the bundler when its context can, and throw in case it only records. */
export function fail(ctx: object, message: string): never {
  if ('error' in ctx && typeof ctx.error === 'function') ctx.error(message);
  throw new Error(message);
}

/** The tables beside each icons.gen module and declared by each package directory. */
export function tablesFrom(gens: Iterable<string>, pkgs: Iterable<string>): IconTable[] {
  return [...[...gens].map(tableBeside), ...[...pkgs].map(declaredTable)].filter((t): t is IconTable => t !== undefined);
}

/**
 * App mode's tables and refs. A build records each module's use, and at its end rebuilds both from
 * the modules it still holds, so a watch rebuild forgets what an earlier build saw.
 */
export function iconCatalog(variants: Record<string, VariantFilter>) {
  const refs = new Map<string, string>();
  const tables = new Map<string, IconTable>();
  const uses = new Map<string, ModuleUse>();

  const add = (ctx: object, table: IconTable) => {
    const held = tables.get(table.namespace);
    if (held && held.owner !== table.owner) {
      fail(ctx, `the icon namespace "${table.namespace}" is claimed by both ${held.owner} and ${table.owner}`);
    }
    if (table.namespace in variants) {
      fail(ctx, `the custom icon variant "${table.namespace}" has the name of ${table.owner}'s icon namespace`);
    }
    tables.set(table.namespace, held ? { ...table, icons: { ...held.icons, ...table.icons } } : table);
  };

  return {
    add,
    record: (id: string, use: ModuleUse) => void uses.set(id, use),
    /** Drop the modules a rebuild no longer holds. */
    keep(live: ReadonlySet<string>) {
      for (const id of uses.keys()) if (!live.has(id)) uses.delete(id);
    },
    /** Read every table afresh from the recorded uses, and fail on a ref no table holds. */
    settle(ctx: object) {
      tables.clear();
      refs.clear();
      const all = [...uses.values()];
      const pkgs = new Set(all.flatMap((u) => (u.pkg ? [u.pkg] : [])));
      for (const t of tablesFrom(new Set(all.flatMap((u) => u.gens)), pkgs)) add(ctx, t);
      for (const u of all) for (const ref of u.refs) if (!refs.has(ref)) refs.set(ref, u.file);
      for (const [ref, from] of refs) {
        const parts = splitIconRef(ref);
        const table = parts && tables.get(parts.namespace);
        if (!parts || !table) fail(ctx, `no package in this build provides the icon namespace "${parts?.namespace ?? ref}" (named in ${from})`);
        if (!table.icons[parts.name]) fail(ctx, `icon "${ref}" is not in ${table.owner}'s table (named in ${from})`);
      }
    },
    /** The tables a variant holds; in dev the used variant holds every table. */
    variant(ctx: object, variant: string, dev: boolean): IconTable[] {
      const all = [...tables.values()];
      if (variant === USED) return dev ? all : subset(all, (ns, name) => refs.has(`${ns}:${name}`));
      if (variant === 'all') return all;
      const custom = variants[variant];
      if (custom) return subset(all, admits(custom));
      const own = tables.get(variant);
      if (!own) fail(ctx, `virtual:weasel-icons/${variant} names no custom variant and no icon namespace in this build`);
      return [own];
    },
  };
}
