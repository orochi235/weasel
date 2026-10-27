import type { MenuEntry } from '@weasel-js/menu';
import {
  prefHoldsValue, prefLeaves, prefObjectBase, prefVariantDefault, prefVariantOf,
  type PrefField, type PrefGroup, type PrefLeaf, type PrefList, type PrefMap, type PrefObject, type PrefPaint,
  type PrefUnion,
} from '@weasel-js/prefs';

/** How values are read and written where a set of rows is drawn. */
export interface MenuAccess {
  values(path: string): unknown;
  onChange?: (path: string, value: unknown) => void;
}

/** What a compound leaf draws its parts with. */
export interface MenuDraw {
  /** The schema a `field` leaf offers the fields of. */
  root: PrefGroup;
  access: MenuAccess;
  /** The rows of one leaf at `key`, inside the list or map entry at `entry` when given. */
  leaf(leaf: PrefLeaf, key: string, access: MenuAccess, off: boolean, entry?: string): MenuEntry[];
  /** The rows of an object's fields, whose paths start at `prefix`. */
  fields(fields: PrefObject['children'], prefix: string, access: MenuAccess, off: boolean): MenuEntry[];
}

const noop = () => {};
const sep = (key: string): MenuEntry => ({ kind: 'separator', key });
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** `container` with the value at `segs` replaced, every container on the way copied. */
function setIn(container: unknown, segs: readonly string[], value: unknown): unknown {
  const [head, ...rest] = segs;
  if (head === undefined) return value;
  if (Array.isArray(container)) {
    const out = [...container];
    out[Number(head)] = setIn(container[Number(head)], rest, value);
    return out;
  }
  const base = isRecord(container) ? container : {};
  const next = setIn(base[head], rest, value);
  if (next !== undefined) return { ...base, [head]: next };
  const { [head]: _dropped, ...kept } = base;
  return kept;
}

/** Reads and writes below `path` through the value `held` reads, which a write replaces whole. */
function below(outer: MenuAccess, path: string, held: () => unknown, writable: boolean): MenuAccess {
  const inside = (p: string) => p.startsWith(`${path}.`);
  const rel = (p: string) => p.slice(path.length + 1);
  const values = (p: string): unknown => {
    if (!inside(p)) return outer.values(p);
    let cur = held();
    for (const seg of rel(p).split('.')) cur = cur !== null && typeof cur === 'object' ? (cur as Record<string, unknown>)[seg] : undefined;
    return cur;
  };
  const { onChange } = outer;
  if (!onChange || !writable) return { values };
  return {
    values,
    onChange: (p, v) => (inside(p) ? onChange(path, setIn(held(), rel(p).split('.'), v)) : onChange(p, v)),
  };
}

function submenu(key: string, leaf: PrefLeaf, entries: MenuEntry[]): MenuEntry[] {
  if (entries.length === 0) return [];
  return [{
    kind: 'submenu', key, label: leaf.name, entries,
    ...(leaf.icon ? { icon: leaf.icon } : {}),
    ...(leaf.access ? { access: leaf.access } : {}),
  }];
}

/** An object as a submenu of its fields; each edit writes the object whole. */
export function objectRows(draw: MenuDraw, leaf: PrefObject, key: string, path: string, off: boolean): MenuEntry[] {
  const held = () => prefObjectBase(leaf, draw.access.values(path));
  const access = below(draw.access, path, held, true);
  return submenu(key, leaf, draw.fields(leaf.children, path, access, off || leaf.readout === true));
}

/** A list as a submenu of its entries, each drawn as its item and named for its place, with rows that add an entry
 *  and remove the last one within the list's bounds. */
export function listRows(draw: MenuDraw, leaf: PrefList, key: string, path: string, off: boolean): MenuEntry[] {
  const held = (): readonly unknown[] => {
    const v = draw.access.values(path);
    return Array.isArray(v) ? v : Array.isArray(leaf.default) ? leaf.default : [];
  };
  const frozen = off || leaf.readout === true;
  const access = below(draw.access, path, held, true);
  const name = leaf.item.name || leaf.name;
  const items = held();
  const rows = items.flatMap((_, i) =>
    draw.leaf({ ...leaf.item, name: `${name} ${i + 1}` }, `${path}.${i}`, access, frozen, `${path}.${i}`));
  const { onChange } = draw.access;
  if (onChange && !leaf.readout) {
    const n = items.length;
    rows.push(sep(`${path}/±`), {
      kind: 'item', key: `${path}/+`, label: `Add ${name}`,
      disabled: frozen || (leaf.maxItems !== undefined && n >= leaf.maxItems),
      run: () => onChange(path, [...held(), leaf.item.default]),
    });
    if (n > 0) {
      rows.push({
        kind: 'item', key: `${path}/-`, label: `Remove ${name} ${n}`,
        disabled: frozen || n <= (leaf.minItems ?? 0),
        run: () => onChange(path, held().slice(0, -1)),
      });
    }
  }
  return submenu(key, leaf, rows);
}

/** A map as a submenu of its entries, each drawn as its item and named for its key. A key holding a `.` cannot be
 *  addressed by a path, and is left out. */
export function mapRows(draw: MenuDraw, leaf: PrefMap, key: string, path: string, off: boolean): MenuEntry[] {
  const held = (): Record<string, unknown> => {
    const v = draw.access.values(path);
    return isRecord(v) ? v : isRecord(leaf.default) ? leaf.default : {};
  };
  const access = below(draw.access, path, held, true);
  const rows = Object.keys(held())
    .filter((k) => !k.includes('.'))
    .flatMap((k) => draw.leaf({ ...leaf.item, name: k }, `${path}.${k}`, access, off || leaf.readout === true, `${path}.${k}`));
  return submenu(key, leaf, rows);
}

/** A union as a submenu: its variants as radio rows, then the fields of the variant it holds. Choosing a variant
 *  writes that variant's default. */
export function unionRows(draw: MenuDraw, leaf: PrefUnion, key: string, path: string, off: boolean): MenuEntry[] {
  const frozen = off || leaf.readout === true;
  const current = prefVariantOf(leaf, draw.access.values(path)) ?? prefVariantOf(leaf, leaf.default);
  const { onChange } = draw.access;
  const choices = Object.entries(leaf.variants).map(([v, variant]): MenuEntry => ({
    kind: 'item', key: `${path}/${v}`, label: variant.name, checked: v === current?.[0],
    disabled: frozen || !onChange,
    run: onChange ? () => onChange(path, prefVariantDefault(leaf, v)) : noop,
  }));
  if (!current) return submenu(key, leaf, choices);
  const [v, variant] = current;
  const held = () => {
    const now = draw.access.values(path);
    return prefVariantOf(leaf, now)?.[0] === v ? now : prefVariantDefault(leaf, v);
  };
  const fields = draw.fields(variant.children, path, below(draw.access, path, held, true), frozen);
  return submenu(key, leaf, fields.length ? [...choices, sep(`${path}/|`), ...fields] : choices);
}

/** A field reference as a submenu of radio rows, one per value-holding leaf of the schema it may name. */
export function fieldRows(draw: MenuDraw, leaf: PrefField, key: string, path: string, off: boolean): MenuEntry[] {
  const held = draw.access.values(path);
  const { onChange } = draw.access;
  const rows: MenuEntry[] = [];
  for (const [p, l] of prefLeaves(draw.root)) {
    if (p === path || !prefHoldsValue(l) || (leaf.kinds && !leaf.kinds.includes(l.kind))) continue;
    rows.push({
      kind: 'item', key: `${path}/${p}`, label: l.name || p, checked: held === p,
      disabled: off || leaf.readout === true || !onChange,
      run: onChange ? () => onChange(path, p) : noop,
    });
  }
  return submenu(key, leaf, rows);
}

/** A paint as a color row when it is solid or none, which writes a solid paint keeping its other fields; any other
 *  kind reads as its name and kind. */
export function paintRows(draw: MenuDraw, leaf: PrefPaint, key: string, path: string, off: boolean): MenuEntry[] {
  const held = draw.access.values(path);
  const access = leaf.access ? { access: leaf.access } : {};
  const solid = isRecord(held) && (held.kind === undefined || held.kind === 'solid') && typeof held.color === 'string';
  if (held != null && !solid) {
    const kind = isRecord(held) && typeof held.kind === 'string' ? held.kind : '—';
    return [{ kind: 'item', key, label: `${leaf.name}: ${kind}`, ...access, disabled: true, run: noop }];
  }
  const { onChange } = draw.access;
  return [{
    kind: 'color', key, label: leaf.name, ...access,
    ...(off ? { disabled: true } : {}),
    value: solid ? (held as { color: string }).color : undefined,
    ...(leaf.alpha ? { alpha: true } : {}),
    ...(leaf.readout || !onChange ? {} : {
      set: (color: string) => onChange(path, { ...(isRecord(held) ? held : {}), color }),
    }),
  }];
}
