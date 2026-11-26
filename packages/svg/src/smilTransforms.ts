/**
 * An element's `transform` as clip targets, one per `<animateTransform>` type. The import bakes
 * the document's transform into each leaf, so an animated one moves every leaf it reaches by the
 * change from that baked transform, carried in the leaf's pose: its box moved and its `transform`
 * turned, scaled or skewed about the box's center. Where several animated transforms reach one
 * leaf, their changes compose, the outer applied last, as the document nests them.
 */
import { createTarget, type Target } from '@weasel-js/animator';
import type { NodeId, PoseOverride } from '@weasel-js/core';
import { invert, multiply, rotate, transformPoint, type Affine, type PoseLinear } from '@weasel-js/geom';
import { parseTransform } from './transform';
import type { AnimatedTransform } from './types';
import type { SvgDraftPose } from './draftPose';
import type { SvgClipScene } from './smilGeometry';

/** A leaf transforms reach: its pose as the import left it, the map from the document's
 *  coordinates into its frame, its one ply, and the elements reaching it, outermost first. */
interface Leaf {
  readonly node: NodeId;
  readonly rest: SvgDraftPose;
  readonly frame: Affine;
  readonly frameInverse: Affine;
  readonly ply: PoseOverride<unknown, Record<string, unknown>>;
  readonly elements: Element[];
}

/** An element whose transform is animated: the values committed and shown for each type, and its depth in the document. */
interface Element {
  readonly record: AnimatedTransform;
  readonly depth: number;
  readonly committed: Map<string, number[]>;
  readonly shown: Map<string, number[]>;
  readonly leaves: Leaf[];
}

/** The values of each type that leave a point where it is. */
const NEUTRAL: Readonly<Record<string, number[]>> = { translate: [0, 0], scale: [1, 1], rotate: [0, 0, 0], skewX: [0], skewY: [0] };

const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

const quiet = (): void => {};

/** `rest` moved by `by`, a map in its own frame's coordinates: its center carried and its linear part turned into its `transform`. */
function poseMovedBy(rest: SvgDraftPose, by: Affine): SvgDraftPose {
  const cx = rest.x + rest.width / 2;
  const cy = rest.y + rest.height / 2;
  const [x, y] = transformPoint(by, cx, cy);
  const turn = rest.rotation ? rotate(rest.rotation) : null;
  const [a, b, c, d] = rest.transform ?? [1, 0, 0, 1];
  let linear: Affine = multiply([by[0], by[1], by[2], by[3], 0, 0], turn ?? IDENTITY);
  if (turn) linear = multiply(invert(turn)!, linear);
  linear = multiply(linear, [a, b, c, d, 0, 0]);
  const transform: PoseLinear = [linear[0], linear[1], linear[2], linear[3]];
  return { ...rest, x: rest.x + x - cx, y: rest.y + y - cy, transform };
}

/** The change `values` make to `record`'s transform, in the document's coordinates; null for a singular one. */
function changeOf(record: AnimatedTransform, values: ReadonlyMap<string, number[]>): Affine | null {
  if (values.size === 0) return IDENTITY;
  const now = [...values].reduce<Affine>((m, [type, v]) => multiply(m, parseTransform(`${type}(${v.join(' ')})`, quiet)), IDENTITY);
  const ownInverse = invert(record.own);
  const aboveInverse = invert(record.above);
  if (!ownInverse || !aboveInverse) return null;
  return multiply(record.above, multiply(now, multiply(ownInverse, aboveInverse)));
}

/** What a transform target reaches: the leaf nodes under the element, and each one's frame (from the document's coordinates into the node's). */
export interface TransformReach {
  readonly nodes: readonly string[];
  readonly depth: number;
  frameOf(node: string): Affine | null;
}

/**
 * A maker of transform targets: `target(element, type, record, reach)` is the target of one
 * `<animateTransform>` type of `element` (`translate`, `scale`, `rotate`, `skewX`, `skewY`),
 * moving the leaves `reach` names. Undefined where none of them is still in the scene.
 */
export function createTransformTargets(scene: SvgClipScene): (element: string, type: string, record: AnimatedTransform, reach: TransformReach) => Target<number[]> | undefined {
  const targets = new Map<string, Target<number[]>>();
  const elements = new Map<string, Element>();
  const leaves = new Map<string, Leaf>();

  const leafOf = (id: string, frameOf: TransformReach['frameOf']): Leaf | undefined => {
    const held = leaves.get(id);
    if (held) return held;
    const n = scene.get(id as NodeId);
    const frame = frameOf(id);
    const frameInverse = frame && invert(frame);
    if (!n || !frame || !frameInverse) return undefined;
    const leaf: Leaf = { node: id as NodeId, rest: n.pose, frame, frameInverse, ply: {}, elements: [] };
    leaves.set(id, leaf);
    return leaf;
  };

  /** `leaf`'s pose under every element's values as `pick` reads them; null where nothing has moved it. */
  const poseOf = (leaf: Leaf, pick: (e: Element) => ReadonlyMap<string, number[]>): SvgDraftPose | null => {
    let by = IDENTITY;
    let moved = false;
    for (const e of leaf.elements) {
      const values = pick(e);
      if (values.size > 0) moved = true;
      const change = changeOf(e.record, values);
      if (!change) return null;
      by = multiply(by, change);
    }
    return moved ? poseMovedBy(leaf.rest, multiply(leaf.frame, multiply(by, leaf.frameInverse))) : null;
  };
  const committedOf = (e: Element): ReadonlyMap<string, number[]> => e.committed;
  const nowOf = (e: Element): ReadonlyMap<string, number[]> => (e.shown.size === 0 ? e.committed : new Map([...e.committed, ...e.shown]));

  return (element, type, record, reach) => {
    const key = `${element}\u0000${type}`;
    const held = targets.get(key);
    if (held) return held;
    if (!Object.hasOwn(NEUTRAL, type)) return undefined;
    let e = elements.get(element);
    if (!e) {
      e = { record, depth: reach.depth, committed: new Map(), shown: new Map(), leaves: [] };
      for (const id of reach.nodes) {
        const leaf = leafOf(id, reach.frameOf);
        if (!leaf) continue;
        leaf.elements.push(e);
        leaf.elements.sort((a, b) => a.depth - b.depth);
        e.leaves.push(leaf);
      }
      elements.set(element, e);
    }
    const el = e;
    if (el.leaves.length === 0) return undefined;
    const target: Target<number[]> = createTarget<number[]>({
      get: () => el.committed.get(type) ?? NEUTRAL[type],
      set(value) {
        el.committed.set(type, value);
        scene.untracked(() => {
          for (const leaf of el.leaves) scene.setPose(leaf.node, poseOf(leaf, committedOf) ?? leaf.rest);
        });
      },
      show(value) {
        if (target.active) el.shown.set(type, value);
        else el.shown.delete(type);
        for (const leaf of el.leaves) {
          const live = leaf.elements.some((x) => x.shown.size > 0);
          const pose = live ? poseOf(leaf, nowOf) : null;
          if (!pose) {
            scene.overrides.clear(leaf.node, leaf.ply);
            continue;
          }
          leaf.ply.pose = pose;
          if (!scene.overrides.has(leaf.node, leaf.ply)) scene.overrides.set(leaf.node, leaf.ply);
        }
      },
      publish: () => scene.overrides.commit(),
    });
    targets.set(key, target);
    return target;
  };
}
