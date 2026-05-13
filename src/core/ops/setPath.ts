import type { Op } from './types';

export interface SetPathFields {
  path: unknown;     // Path | RectPath; left unknown so kit doesn't depend on features/paths/types here
  closed: boolean;
  params: unknown;
}

interface SetPathAdapter {
  setPath(id: string, fields: SetPathFields): void;
}

/**
 * Op: atomically replace a PathObj's geometric fields (path + closed + params).
 * Used for pen-edit anchor mutations and parametric-shape trapdoor conversions.
 * Reports no-op when `from` and `to` are structurally equal (same path bytes,
 * closed, params), letting history skip the entry.
 */
export function createSetPathOp(args: {
  id: string;
  from: SetPathFields;
  to: SetPathFields;
  label?: string;
  coalesceKey?: string;
}): Op {
  const { id, from, to, label, coalesceKey } = args;
  return {
    label,
    coalesceKey,
    apply(adapter) {
      // Always call setPath so consumers that inspect op behavior see a
      // consistent "this op writes (id, to)" signal. When from and to
      // are field-equal, additionally report a no-op to history so the
      // entry can be skipped from the undo stack. setPath with the same
      // value is idempotent.
      (adapter as SetPathAdapter).setPath(id, to);
      if (fieldsEqual(from, to)) return false;
      return undefined;
    },
    invert() {
      return createSetPathOp({ id, from: to, to: from, label, coalesceKey });
    },
  };
}

function fieldsEqual(a: SetPathFields, b: SetPathFields): boolean {
  if (a === b) return true;
  if (a.closed !== b.closed) return false;
  if (!shallowEqual(a.params, b.params)) return false;
  return pathEqual(a.path, b.path);
}

function pathEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ao = a as { kind?: string };
  const bo = b as { kind?: string };
  if (ao.kind !== bo.kind) return false;
  if (ao.kind === 'rect') return shallowEqual(a, b);
  // polygon: compare commands + coords arrays
  const aa = a as { commands: ArrayLike<number>; coords: ArrayLike<number> };
  const bb = b as { commands: ArrayLike<number>; coords: ArrayLike<number> };
  if (aa.commands.length !== bb.commands.length) return false;
  if (aa.coords.length !== bb.coords.length) return false;
  for (let i = 0; i < aa.commands.length; i++) if (aa.commands[i] !== bb.commands[i]) return false;
  for (let i = 0; i < aa.coords.length; i++) if (aa.coords[i] !== bb.coords[i]) return false;
  return true;
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if ((a as Record<string, unknown>)[k] !== (b as Record<string, unknown>)[k]) return false;
  }
  return true;
}
