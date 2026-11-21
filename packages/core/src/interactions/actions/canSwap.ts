import type { ActionDeps } from '@weasel-js/routing';
import { asNodeId, type NodeId, type Scene } from 'core/scene/types';
import { documentOf } from 'core/scene/documentOf';
import { isPageStructure } from 'core/scene/nodeGates';
import { admitsChild } from './admitsChild';
import { nodeDescriptors, poseDescriptorOf } from './poseDescriptorDep';
import { scenePoseFrame } from './poseFrame';

/**
 * Whether the nodes `a` and `b` may trade places: a swap drop or the `swap`
 * command asks it about two nodes {@link swappable}'s fixed rules already
 * allow. Absent, two nodes of one `kind` and one size swap.
 */
export type CanSwapDep = (a: string, b: string) => boolean;

/** How far apart two sizes may be and still count as one, relative to the larger. */
const SIZE_EPSILON = 1e-6;

const sameLength = (p: number, q: number): boolean =>
  Math.abs(p - q) <= SIZE_EPSILON * Math.max(1, Math.abs(p), Math.abs(q));

/** Whether `id` is `of` or under it. */
function within(scene: Scene<unknown, string, unknown>, id: NodeId, of: NodeId): boolean {
  const seen = new Set<NodeId>();
  for (let at: NodeId | null = id; at !== null && !seen.has(at); at = scene.get(at)?.parent ?? null) {
    if (at === of) return true;
    seen.add(at);
  }
  return false;
}

/**
 * The one rule for whether `a` and `b` can trade places, by a drop or the `swap` command. Two different
 * nodes, neither inside the other, neither locked, neither a page or the page run, and, under two parents, each
 * one a child the other's parent takes (`childVerdict`, with the `canDropInto` dep). Then the `canSwap`
 * dep decides when present, else they swap when they are of one `kind` and their bounds, as the
 * `poseDescriptor` dep measures them, are one size.
 */
export function swappable(
  scene: Scene<unknown, string, unknown>,
  a: string,
  b: string,
  deps: Pick<ActionDeps, 'canSwap' | 'canDropInto' | 'poseDescriptor'> = {},
): boolean {
  const ia = asNodeId(a);
  const ib = asNodeId(b);
  const na = scene.get(ia);
  const nb = scene.get(ib);
  if (na === undefined || nb === undefined || a === b) return false;
  if (isPageStructure(na) || isPageStructure(nb)) return false;
  if (scene.isLocked(ia) || scene.isLocked(ib)) return false;
  if (within(scene, ia, ib) || within(scene, ib, ia)) return false;
  const pa = na.parent ?? null;
  const pb = nb.parent ?? null;
  if (pa !== pb) {
    const takes = (parent: NodeId | null, id: string) => parent === null || admitsChild(scene, parent, [id], deps.canDropInto);
    if (!takes(pb, a) || !takes(pa, b)) return false;
  }
  if (deps.canSwap !== undefined) return deps.canSwap(a, b);
  if (na.kind !== nb.kind) return false;
  const doc = documentOf(scene);
  const frame = scenePoseFrame(doc);
  const descriptorOf = nodeDescriptors(doc, poseDescriptorOf(deps.poseDescriptor));
  const ba = descriptorOf(ia).getBounds(frame.world(ia));
  const bb = descriptorOf(ib).getBounds(frame.world(ib));
  return sameLength(ba.width, bb.width) && sameLength(ba.height, bb.height);
}
