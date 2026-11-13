// What "auto" and "reset" mean for a leaf, answered once for every surface that edits one: a store, a form, a
// lab's controls.

import { deepEqual } from '@weasel-js/registry';
import type { PrefGroup, PrefSection } from './groups';
import { isPrefLeaf, isPrefSection, prefHoldsValue } from './helpers';
import type { PrefLeaf } from './schema';

/** Whether a leaf can be auto: every leaf holding a value, but one that says `auto: false`. */
export function prefCanAuto(leaf: PrefLeaf): boolean {
  return leaf.auto !== false && prefHoldsValue(leaf);
}

/** Whether a leaf starts auto, unpinned: one that says `auto: { on: true }`. */
export function prefStartsAuto(leaf: PrefLeaf): boolean {
  return prefCanAuto(leaf) && leaf.auto !== undefined && leaf.auto !== false && leaf.auto.on === true;
}

/**
 * What a leaf reads while it is auto: what its owner `computed`, where it computed one; else its `auto.value`;
 * else its default, which is `otherwise` where a reader holds the default in another form (a store, a split
 * default as a scope).
 */
export function prefAutoValue(leaf: PrefLeaf, computed?: unknown, otherwise: unknown = leaf.default): unknown {
  if (computed !== undefined) return computed;
  const declared = leaf.auto === false ? undefined : leaf.auto?.value;
  return declared !== undefined ? declared : otherwise;
}

/** What a reset makes of a leaf: unpinned (`auto`) where its schema starts it so, else pinned at its default.
 *  `value` is what it reads afterward. */
export interface PrefReset {
  auto: boolean;
  value: unknown;
}

/** What resetting `leaf` makes of it: back to what its schema says. */
export function prefResetOf(leaf: PrefLeaf): PrefReset {
  const auto = prefStartsAuto(leaf);
  return { auto, value: auto ? prefAutoValue(leaf) : leaf.default };
}

/** What a holder that keeps a leaf's stored form writes to reset it while pinned: nothing for a leaf with an
 *  `encoding`, which reads holding nothing as its default; else the value it reads after the reset. */
export function prefStoredReset(leaf: PrefLeaf): unknown {
  return (leaf as { encoding?: unknown }).encoding !== undefined ? undefined : prefResetOf(leaf).value;
}

/**
 * Whether `leaf` already is what a reset makes of it. `auto` is whether it is unpinned now, or `undefined` on a
 * surface that keeps no auto state, which then compares `value` with what the leaf reads after a reset; `value`
 * is the value it holds while pinned.
 */
export function prefIsReset(leaf: PrefLeaf, state: { auto: boolean | undefined; value: unknown }): boolean {
  const reset = prefResetOf(leaf);
  if (state.auto === undefined) return deepEqual(state.value, reset.value);
  if (reset.auto) return state.auto;
  return !state.auto && deepEqual(state.value, reset.value);
}

/** One leaf a reset reaches, at its path, with what the reset makes of it. */
export interface PrefResetEntry extends PrefReset {
  path: string;
  leaf: PrefLeaf;
}

const joined = (at: string, key: string): string => (at === '' ? key : `${at}.${key}`);

/**
 * Every leaf a reset of `node` reaches, with what it makes of each: the leaf itself, or each leaf holding a
 * value under a group or a section, readouts left out. `at` is the node's path; for a section, whose key adds
 * nothing to its members' paths, the path they are relative to.
 */
export function prefResets(node: PrefLeaf | PrefGroup | PrefSection, at: string): PrefResetEntry[] {
  if (isPrefLeaf(node)) {
    if (!prefHoldsValue(node) || (node as { readout?: boolean }).readout === true) return [];
    return [{ path: at, leaf: node, ...prefResetOf(node) }];
  }
  if (isPrefSection(node)) {
    return Object.entries(node.members).flatMap(([key, child]) =>
      prefResets(child, isPrefLeaf(child) ? joined(at, key) : at),
    );
  }
  return Object.entries(node.children).flatMap(([key, child]) => prefResets(child, joined(at, key)));
}
