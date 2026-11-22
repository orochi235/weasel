/**
 * Re-fitting a fitted container around what it holds once a layout has moved
 * it, so the box a scene stores is the one `diagramScene` would have built.
 */
import {
  composeWorldPose,
  heldInFrame,
  rebaseLocalPose,
  settleWithinRounding,
  type NodeId,
  type PoseAdapter,
  type PoseComposition,
  type Scene,
} from '@weasel-js/core';
import { maxOf, minOf } from '@weasel-js/geom';
import { diagramContainerOf, headerBox, isFittedContainer, titleIdOf, type DiagramContainer } from './containers/trait';
import { grownBy } from './footprint';
import { fittedInsetOf } from './graph';
import type { LayoutFrame } from './layoutFrame';
import type { Bounds } from './outline';
import { diagramNodeOf } from './trait';

/** What re-fitting reads and where it writes. */
export interface FitContext<TPose> {
  scene: Scene<unknown, string, TPose>;
  /** Stored poses, reading `out` first. */
  decided: PoseAdapter<TPose>;
  composition: Pick<PoseComposition<TPose>, 'compose' | 'decompose'>;
  frame: LayoutFrame<TPose>;
  /** Nodes another gesture owns: a container holding one in its frame keeps its frame. */
  fixed: (id: string) => boolean;
}

const fittedOf = <TPose>(scene: Scene<unknown, string, TPose>, id: string): DiagramContainer | null => {
  const node = scene.get(id as never);
  const c = node === undefined ? null : diagramContainerOf(node);
  return c !== null && isFittedContainer(c) ? c : null;
};

const sameBox = (a: Bounds, b: Bounds): boolean => (['x', 'y', 'width', 'height'] as const)
  .every((k) => settleWithinRounding(a[k], b[k], Math.max(Math.abs(a[k]), Math.abs(b[k]))) === a[k]);

/**
 * Re-fit every fitted container above a node in `out`, innermost first, and
 * re-store what its frame holds so each keeps the world place `out` gave it.
 * Writes into `out`.
 */
export function refitContainers<TPose>(ctx: FitContext<TPose>, out: Map<string, TPose>): void {
  const { scene } = ctx;
  const depthOf = new Map<string, number>();
  for (const id of [...out.keys()]) {
    const chain: string[] = [];
    for (let at = scene.get(id as never)?.parent; at != null; at = scene.get(at)?.parent) chain.push(at as string);
    chain.forEach((p, i) => { if (fittedOf(scene, p) !== null) depthOf.set(p, chain.length - i); });
  }
  const order = [...depthOf.keys()].sort((a, b) => depthOf.get(b)! - depthOf.get(a)!);
  for (const id of order) refitOne(ctx, out, id, fittedOf(scene, id)!);
}

/** The union of what `id` holds, each node grown by its margin; null when it holds nothing. */
function heldBox<TPose>(ctx: FitContext<TPose>, id: string): Bounds | null {
  const { scene, decided, composition, frame } = ctx;
  const boxes: Bounds[] = [];
  for (const c of scene.childrenOf(id as never)) {
    const node = scene.get(c);
    if (node === undefined || c === titleIdOf(id)) continue;
    const trait = diagramNodeOf(node);
    if (trait === null) continue;
    const box = frame.box(composeWorldPose(decided, c, composition.compose));
    boxes.push(diagramContainerOf(node) === null ? grownBy(box, trait.margin) : box);
  }
  if (boxes.length === 0) return null;
  const x = minOf(boxes, (b) => b.x);
  const y = minOf(boxes, (b) => b.y);
  return { x, y, width: maxOf(boxes, (b) => b.x + b.width) - x, height: maxOf(boxes, (b) => b.y + b.height) - y };
}

function refitOne<TPose>(ctx: FitContext<TPose>, out: Map<string, TPose>, id: string, region: DiagramContainer): void {
  const { scene, decided, composition, frame } = ctx;
  const { compose, decompose } = composition;
  const held = heldInFrame(scene, id as NodeId);
  if (held.some((c) => ctx.fixed(c))) return;
  const inner = heldBox(ctx, id);
  if (inner === null) return;
  const inset = fittedInsetOf(region);
  const box = grownBy(inner, inset);
  const world = composeWorldPose(decided, id, compose);
  if (sameBox(frame.box(world), box)) return;
  const kept = held.map((c) => [c, composeWorldPose(decided, c, compose)] as const);
  const stored = rebaseLocalPose(decided, frame.fromBox(box, world), scene.get(id as never)!.parent, compose, decompose);
  if (stored === null) return;
  out.set(id, stored);
  const header = headerBox(box, region.header);
  for (const [c, was] of kept) {
    const now = c === titleIdOf(id) && header !== null ? frame.fromBox(header, was) : was;
    const local = rebaseLocalPose(decided, now, decided.getParent(c), compose, decompose);
    if (local !== null) out.set(c, local);
  }
}
