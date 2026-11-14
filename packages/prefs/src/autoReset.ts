// What "auto" and "reset" mean for a leaf, answered once for every surface that edits one: a store, a form, a
// lab's controls.

import { deepEqual } from '@weasel-js/registry';
import type { PrefGroup, PrefSection } from './groups';
import { isPrefLeaf, isPrefSection, prefHoldsValue } from './helpers';
import type { PrefLeaf } from './schema';
import { prefLeafValue } from './leafValue';

/** Whether a leaf can be auto: one holding a value that opts in by declaring `auto`. A leaf without it never is. */
export function prefCanAuto(leaf: PrefLeaf): boolean {
  return typeof leaf.auto === 'object' && leaf.auto !== null && prefHoldsValue(leaf);
}

/** Whether a leaf starts auto, unpinned: one that says `auto: { on: true }`. */
export function prefStartsAuto(leaf: PrefLeaf): boolean {
  return prefCanAuto(leaf) && leaf.auto!.on === true;
}

/**
 * What a leaf reads while it is auto: what its owner `computed` (a labkit `.auto(fn)` resolver, a value an
 * instrument reports), where it computed one; else its `auto.value`. Never its `default`: with neither, it reads
 * `undefined`.
 */
export function prefAutoValue(leaf: PrefLeaf, computed?: unknown): unknown {
  return computed !== undefined ? computed : leaf.auto?.value;
}

/** What a reset makes of a leaf: unpinned (`auto`) where its schema starts it so, else pinned at its default.
 *  `value` is what it reads afterward where nothing computes it. */
export interface PrefReset {
  auto: boolean;
  value: unknown;
}

/** What resetting `leaf` makes of it: back to what its schema says. */
export function prefResetOf(leaf: PrefLeaf): PrefReset {
  const auto = prefStartsAuto(leaf);
  return { auto, value: auto ? prefAutoValue(leaf) : leaf.default };
}

/** What a holder that keeps a leaf's stored form and no auto state writes to reset it: nothing for a leaf with
 *  an `encoding`, which reads holding nothing as its default; else its default. */
export function prefStoredReset(leaf: PrefLeaf): unknown {
  return (leaf as { encoding?: unknown }).encoding !== undefined ? undefined : leaf.default;
}

/**
 * Whether `leaf` already is what a reset makes of it. `auto` is whether it is unpinned now, or `undefined` on a
 * surface that keeps no auto state, where nothing is auto and a reset leaves the leaf at its default; `value`
 * is the value it holds while pinned.
 */
export function prefIsReset(leaf: PrefLeaf, state: { auto: boolean | undefined; value: unknown }): boolean {
  if (state.auto === undefined) return deepEqual(state.value, leaf.default);
  const reset = prefResetOf(leaf);
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

/** Written at a leaf's path to unpin it: "let the owner decide". labkit's `auto` sentinel is this symbol. */
export const AUTO: unique symbol = Symbol('weasel.auto');

/** The type of {@link AUTO}, for widening a value parameter. */
export type Auto = typeof AUTO;

/**
 * What a surface reads at a leaf's path. `value` is the value as shown, an encoded leaf's read through its
 * encoding; `each` holds one value as shown per target (one for a form or a lab, one per selected node), and
 * `mixed` says they disagree. `auto` is whether the leaf is unpinned now, or undefined where it cannot be auto
 * here: it does not opt in, or the surface keeps no auto state for it.
 */
export interface LeafReading<T = unknown> {
  value: T | undefined;
  mixed: boolean;
  each: readonly T[];
  auto?: boolean;
}

/** Whether a reset of `leaf` would leave every target as it is: a readout, which no reset reaches, always is. */
export function leafIsAtReset(leaf: PrefLeaf, reading: LeafReading): boolean {
  if (!prefHoldsValue(leaf) || (leaf as { readout?: boolean }).readout === true) return true;
  if (reading.mixed) return false;
  return reading.each.every((value) => prefIsReset(leaf, { auto: reading.auto, value: prefLeafValue(leaf, value) }));
}

/** One write a reset makes: {@link AUTO} to unpin, else the value the leaf stores at its default. */
export interface ResetWrite {
  path: string;
  leaf: PrefLeaf;
  write: unknown;
}

/**
 * The writes that put `node`, a leaf or every leaf under a group or a section, back as its schema starts it.
 * `read` answers for a path the surface reads, or `undefined` for a leaf it does not let a reset reach (one an
 * `enableIf` disables). A leaf already at its reset is left out; one that starts auto is unpinned where the
 * surface keeps its auto state, and pinned at its default where it does not.
 */
export function resetPlan(
  node: PrefLeaf | PrefGroup | PrefSection,
  path: string,
  read: (path: string) => LeafReading | undefined,
): ResetWrite[] {
  return prefResets(node, path).flatMap((r) => {
    const reading = read(r.path);
    if (reading === undefined || leafIsAtReset(r.leaf, reading)) return [];
    return [{ path: r.path, leaf: r.leaf, write: r.auto && reading.auto !== undefined ? AUTO : prefStoredReset(r.leaf) }];
  });
}

/** The leaf, group, or section whose path is `path` under `root`, as {@link prefResets} builds paths: a segment
 *  per key under a group, a leaf's own key under a section, and nothing for a section's key. `''` is the root. */
export function prefNodeAt(
  root: PrefLeaf | PrefGroup | PrefSection,
  path: string,
): PrefLeaf | PrefGroup | PrefSection | undefined {
  if (path === '') return root;
  if (isPrefLeaf(root)) return undefined;
  if (isPrefSection(root)) {
    if (Object.hasOwn(root.members, path)) return root.members[path];
    for (const child of Object.values(root.members)) {
      const found = isPrefLeaf(child) ? undefined : prefNodeAt(child, path);
      if (found) return found;
    }
    return undefined;
  }
  const dot = path.indexOf('.');
  const head = dot === -1 ? path : path.slice(0, dot);
  if (!Object.hasOwn(root.children, head)) return undefined;
  return prefNodeAt(root.children[head]!, dot === -1 ? '' : path.slice(dot + 1));
}

/** {@link resetPlan} for each of `paths` under `root`, a leaf's or a group's. */
export function resetPlanAt(
  root: PrefGroup | PrefSection,
  paths: readonly string[],
  read: (path: string) => LeafReading | undefined,
): ResetWrite[] {
  return paths.flatMap((path) => {
    const node = prefNodeAt(root, path);
    return node ? resetPlan(node, path, read) : [];
  });
}
