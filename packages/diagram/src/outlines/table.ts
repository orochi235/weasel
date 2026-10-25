/**
 * The outline table: every name an `Outline` string can resolve to. The
 * built-ins are seeded here; `registerOutline` adds to them or shadows one.
 */
import { pathFromD, transformPath } from '@weasel-js/geom';
import { FIGURE_OUTLINES } from './figures';
import { FLOWCHART_OUTLINES } from './flowchart';
import { STORAGE_OUTLINES } from './storage';
import type { Bounds, OutlineDef, Size } from './types';

const BUILTINS = { ...FLOWCHART_OUTLINES, ...FIGURE_OUTLINES, ...STORAGE_OUTLINES };

/** A name the kit itself registers. */
export type BuiltinOutline = keyof typeof BUILTINS;

// A stack per name, so a disposer can restore whatever its registration shadowed.
const table = new Map<string, OutlineDef[]>(
  Object.entries(BUILTINS).map(([name, def]) => [name, [def as OutlineDef]]),
);
const warned = new Set<string>();

/** Register `def` under `name`, shadowing any definition already there.
 *  Returns the disposer. */
export function registerOutline(name: string, def: OutlineDef): () => void {
  const stack = table.get(name) ?? [];
  stack.push(def);
  table.set(name, stack);
  return () => {
    const i = stack.lastIndexOf(def);
    if (i >= 0) stack.splice(i, 1);
    if (stack.length === 0) table.delete(name);
  };
}

/** The definition `name` resolves to. An unregistered name resolves to
 *  `rect`, with one warning per name. */
export function resolveOutline(name: string): OutlineDef {
  const def = table.get(name)?.at(-1);
  if (def) return def;
  if (!warned.has(name)) {
    warned.add(name);
    console.warn(`@weasel-js/diagram: no outline named '${name}' is registered; painting it as 'rect'`);
  }
  return FLOWCHART_OUTLINES.rect;
}

const unitMatrix = (b: Bounds): [number, number, number, number, number, number] =>
  [b.width, 0, 0, b.height, b.x, b.y];

/** An outline from SVG path data in a unit square — `(0, 0)` the box's
 *  top-left, `(1, 1)` its bottom-right — stretched over each node's bounds.
 *  `content` is in the same unit square. */
export function outlineFromD(d: string, opts: { detail?: string; content?: Bounds } = {}): OutlineDef {
  const path = pathFromD(d);
  const detail = opts.detail === undefined ? undefined : pathFromD(opts.detail);
  const unit = opts.content ?? { x: 0, y: 0, width: 1, height: 1 };
  return {
    path: (b) => transformPath(path, unitMatrix(b)),
    ...(detail ? { detail: (b: Bounds) => transformPath(detail, unitMatrix(b)) } : {}),
    content: (b) => ({
      x: b.x + unit.x * b.width,
      y: b.y + unit.y * b.height,
      width: unit.width * b.width,
      height: unit.height * b.height,
    }),
    boxForContent: (c: Size) => ({ width: c.width / unit.width, height: c.height / unit.height }),
  };
}
