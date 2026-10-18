import { stateOf, type TargetState } from '../target';
import { rowTableOf } from '../targetTable';
import type { HoldRowsOptions, RowsHoldHandle } from '../types';
import type { AnimationContext, AnimationSeed } from './context';
import type { HoldLayer } from './holdStore';
import { coverOf, enterHold, leaveHold } from './holds';

/** Holds rows of a table in a layer of the table's holds whose values and weights the caller
 *  writes: one row on the animator's table for all of them. */
export function startHoldRows(ctx: AnimationContext, o: HoldRowsOptions): RowsHoldHandle {
  const { table } = o;
  const rows = rowTableOf(table);
  const n = table.axes;
  const store = rows.holds();
  const id = ctx.nextId();
  const seed = {
    id, kind: 'hold', cancelKey: o.cancelKey, label: o.label, keepExisting: o.interrupt === false,
    idle: true, due: Infinity,
  } as AnimationSeed;
  if (o.cancelKey != null && o.interrupt !== false) ctx.interrupt(o.cancelKey, seed);

  let layer!: HoldLayer;
  /** The rows it holds, each with what lets it go. */
  const held = new Map<number, { s: TargetState; part: () => void }>();
  const weight = o.weight ?? 1;
  let covers: Uint8Array | null = null;
  const letGo = (row: number, commit: boolean): void => {
    const h = held.get(row);
    if (!h) return;
    held.delete(row);
    h.s.parts.delete(h.part);
    leaveHold(ctx, h.s, layer, covers, commit);
    // Read apart once, as the pass no longer shows it.
    rows.mark(row);
  };
  for (const row of o.rows ? Array.from(o.rows) : rows.rows()) {
    if (held.has(row)) continue;
    const s = stateOf(table.target(row)) as TargetState;
    covers ??= coverOf(o.axes, s.axes);
    enterHold(ctx, s, (st) => (layer ??= st.layer()), { covers, fixed: true });
    layer.values.set(table.committed.subarray(row * n, (row + 1) * n), row * n);
    layer.weights[row] = weight;
    const part = (): void => letGo(row, true);
    s.parts.add(part);
    held.set(row, { s, part });
  }
  layer ??= store.layer();

  const touch = (): void => {
    for (const row of held.keys()) store.refold(row);
    rows.refill();
    ctx.wake();
  };
  const leave = (commit: boolean): void => {
    for (const row of [...held.keys()]) letGo(row, commit);
    store.drop(layer);
    rows.refill();
    ctx.wake();
  };
  touch();
  seed.onCancel = () => leave(true);
  seed.tick = () => {
    if (!ctx.tripwire()) return false;
    leave(true);
    return true;
  };
  const base = ctx.register(seed);
  return {
    ...base,
    get values() { return layer.values; },
    get weights() { return layer.weights; },
    touch,
    release(r) {
      if (!ctx.has(id)) return;
      leave(r?.commit !== false);
      ctx.finish(id);
    },
  };
}
