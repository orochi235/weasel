/**
 * Where on a sequence a pointer is: which root it is over, and in that root's
 * frame, the lifeline nearest it, the participant index it falls between, and
 * the row slot nearest it. What the authoring actions read a press with.
 */
import type { Scene, Vec2 } from '@weasel-js/core';
import { placedSequences, type PlacedSequence } from './layer';
import { sequenceRootOf } from './trait';
import type { SequenceData, StepPlace } from './types';

type AnyScene = Scene<unknown, string, unknown>;

/** A root under a pointer: where it is, its data, and the pointer in its frame. */
export interface SequenceHit {
  root: PlacedSequence;
  data: SequenceData;
  local: Vec2;
}

/** The topmost unlocked, shown sequence root whose box holds `world`, or `null`. */
export function sequenceAt(scene: AnyScene, world: Vec2): SequenceHit | null {
  const all = placedSequences(scene);
  for (let i = all.length - 1; i >= 0; i--) {
    const root = all[i]!;
    const local = { x: world.x - root.origin.x, y: world.y - root.origin.y };
    if (local.x < 0 || local.y < 0 || local.x > root.width || local.y > root.height) continue;
    const held = sequenceRootOf(scene.get(root.id as never)!);
    if (held !== null) return { root, data: held.sequence, local };
  }
  return null;
}

/** The hit for root `id` with the pointer at `world`, wherever the pointer is. */
export function sequenceHitOf(scene: AnyScene, id: string, world: Vec2): SequenceHit | null {
  const root = placedSequences(scene).find((p) => p.id === id);
  const node = root === undefined ? undefined : scene.get(id as never);
  const held = node === undefined ? null : sequenceRootOf(node);
  if (root === undefined || held === null) return null;
  return { root, data: held.sequence, local: { x: world.x - root.origin.x, y: world.y - root.origin.y } };
}

/** The index of the item of `xs` nearest `x`, or `-1` for none. */
export function nearestIndex(xs: readonly number[], x: number): number {
  return xs.reduce((best, v, i) => (best < 0 || Math.abs(v - x) < Math.abs(xs[best]! - x) ? i : best), -1);
}

/** The lifeline nearest local `x`, or `null` in a sequence with none. */
export function columnNear(root: PlacedSequence, x: number): { id: string; x: number; index: number } | null {
  const i = nearestIndex(root.geometry.columns.map((c) => c.x), x);
  return i < 0 ? null : { ...root.geometry.columns[i]!, index: i };
}

/** The participant index a new lifeline at local `x` takes: after every lifeline left of it. */
export const columnIndexAt = (root: PlacedSequence, x: number): number => root.geometry.columns.filter((c) => c.x < x).length;

/** The row slot nearest local `y`, among those `keep` passes. */
export function slotNear(root: PlacedSequence, y: number, keep: (place: StepPlace) => boolean = () => true): { y: number; place: StepPlace } | null {
  const slots = root.geometry.slots.filter((s) => keep(s.place));
  const i = nearestIndex(slots.map((s) => s.y), y);
  return i < 0 ? null : slots[i]!;
}

/** Whether two places are in the same list. */
export const sameList = (a: StepPlace['parent'], b: StepPlace['parent']): boolean =>
  a === b || (a !== null && b !== null && a.fragment === b.fragment && a.section === b.section);
