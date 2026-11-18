import type { InsertEffect, InsertSlot } from './inserts';
import { writeParam } from './param';

/** One effect's place in an insert chain, with the gains that route it. */
export interface Slot {
  handle: InsertSlot;
  effect: InsertEffect;
  bypassed: boolean;
  removed: boolean;
  /** Built on first splice-in, kept across a move, torn down on removal. */
  nodes: { in: GainNode; out: GainNode; dry: GainNode; wet: GainNode } | null;
}

/** Ramp a built slot's wet and dry to match its `bypassed` flag over `ms`. */
export function writeBypass(ctx: BaseAudioContext, s: Slot, ms: number): void {
  if (!s.nodes) return;
  writeParam(ctx, s.nodes.wet.gain, s.bypassed ? 0 : 1, ms);
  writeParam(ctx, s.nodes.dry.gain, s.bypassed ? 1 : 0, ms);
}

/** Wire a slot's own in, out, wet and dry around its effect, once. */
export function buildSlot(ctx: BaseAudioContext, s: Slot): void {
  if (s.nodes) return;
  const n = {
    in: ctx.createGain(), out: ctx.createGain(), dry: ctx.createGain(), wet: ctx.createGain(),
  };
  n.in.connect(s.effect.input);
  s.effect.output.connect(n.wet);
  n.wet.connect(n.out);
  n.in.connect(n.dry);
  n.dry.connect(n.out);
  s.nodes = n;
  n.wet.gain.value = s.bypassed ? 0 : 1;
  n.dry.gain.value = s.bypassed ? 1 : 0;
  writeBypass(ctx, s, 0);
}

/** Unwire a slot's own nodes, leaving the effect's. */
function destroy(s: Slot): void {
  const n = s.nodes;
  if (!n) return;
  // Targeted, not bare: the effect's nodes are the consumer's, and may be
  // wired to things besides this slot.
  n.in.disconnect();
  try { s.effect.output.disconnect(n.wet); } catch { /* already cut */ }
  n.wet.disconnect();
  n.dry.disconnect();
  n.out.disconnect();
  s.nodes = null;
}

/** Unwire a slot, then hand its effect back through `dispose`. */
export function retireSlot(s: Slot): void {
  destroy(s);
  s.effect.dispose?.();
}
