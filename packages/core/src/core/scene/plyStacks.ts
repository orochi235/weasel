/**
 * Each node's plies of overrides, kept in the order their writers claimed
 * the node, and the path a stack shows.
 */
import type { Path } from '@weasel-js/geom';
import { carryBoxPath } from './depFrame';
import type { NodeId, PoseOverride } from './types';

/** {@link createPlyStacks}'s handle. */
export interface PlyStacks<Entry> {
  /** Per node, its plies bottom first. */
  readonly plies: ReadonlyMap<NodeId, readonly Entry[]>;
  /** Install `entry` on `id`: on top, or where it stood when a full drop took it off. An
   *  installed entry moves to the top. */
  claim(id: NodeId, entry: Entry): void;
  /** Take `entry` off `id` and forget where it stood. Whether it was installed. */
  release(id: NodeId, entry: Entry): boolean;
  /** Take every ply off `id`, each keeping its place for when its writer reinstalls it.
   *  Whether the node had any. */
  drop(id: NodeId): boolean;
  /** {@link PlyStacks.drop} for every node. */
  dropAll(): void;
  /** The deepest stack, and at least 1. */
  depth(): number;
}

/** Empty stacks. */
export function createPlyStacks<Entry extends object>(): PlyStacks<Entry> {
  const plies = new Map<NodeId, Entry[]>();
  /** Each entry's claim, in claiming order; outlives a full drop, so a reinstall goes back in place. */
  const claims = new WeakMap<Entry, number>();
  let claimed = 0;
  /** How many nodes hold each number of plies. */
  const sizes: number[] = [];
  let deepest = 0;

  const resized = (from: number, to: number): void => {
    if (from > 0) sizes[from]!--;
    if (to > 0) sizes[to] = (sizes[to] ?? 0) + 1;
    if (to > deepest) deepest = to;
    while (deepest > 0 && (sizes[deepest] ?? 0) === 0) deepest--;
  };

  return {
    plies,
    claim(id, entry) {
      let stack = plies.get(id);
      if (stack === undefined) plies.set(id, stack = []);
      const at = stack.indexOf(entry);
      if (at >= 0) stack.splice(at, 1);
      let claim = at >= 0 ? undefined : claims.get(entry);
      if (claim === undefined) claims.set(entry, claim = ++claimed);
      let i = stack.length;
      while (i > 0 && claims.get(stack[i - 1]!)! > claim) i--;
      stack.splice(i, 0, entry);
      if (at < 0) resized(stack.length - 1, stack.length);
    },
    release(id, entry) {
      claims.delete(entry);
      const stack = plies.get(id);
      const at = stack?.indexOf(entry) ?? -1;
      if (stack === undefined || at < 0) return false;
      stack.splice(at, 1);
      resized(stack.length + 1, stack.length);
      if (stack.length === 0) plies.delete(id);
      return true;
    },
    drop(id) {
      const stack = plies.get(id);
      if (stack === undefined) return false;
      plies.delete(id);
      resized(stack.length, 0);
      return true;
    },
    dropAll() {
      plies.clear();
      sizes.length = 0;
      deepest = 0;
    },
    depth: () => Math.max(deepest, 1),
  };
}

type Box = { x: number; y: number; width: number; height: number };

const boxOf = (pose: unknown): Box | null => {
  const p = pose as Partial<Box> | null;
  return p !== null && typeof p === 'object' && typeof p.x === 'number' && typeof p.y === 'number'
    && typeof p.width === 'number' && typeof p.height === 'number'
    ? p as Box : null;
};

const sameBox = (a: Box, b: Box): boolean => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/** A carried path and what it was carried from and to, so a stack whose poses hold still shows one path. */
export interface CarriedPath {
  source: Path;
  from: Box;
  to: Box;
  path: Path;
}

/**
 * The path `stack` shows, folded to `pose`: the topmost ply's path, in the box of the pose
 * that ply gives beside it, carried to `pose` where a ply above gives another. A path given
 * with no pose of its own is drawn where it is. `held` keeps the last carry.
 */
export function plyPath<TPose, TData>(
  stack: readonly PoseOverride<TPose, TData>[],
  pose: TPose | undefined,
  held: { carried?: CarriedPath },
): Path | undefined {
  for (let k = stack.length - 1; k >= 0; k--) {
    const ply = stack[k]!;
    if (ply.path === undefined) continue;
    const from = boxOf(ply.pose);
    const to = boxOf(pose);
    if (from === null || to === null || sameBox(from, to)) return ply.path;
    const last = held.carried;
    if (last !== undefined && last.source === ply.path && sameBox(last.from, from) && sameBox(last.to, to)) return last.path;
    held.carried = { source: ply.path, from: { ...from }, to: { ...to }, path: carryBoxPath(ply.path, from, to) };
    return held.carried.path;
  }
  return undefined;
}
