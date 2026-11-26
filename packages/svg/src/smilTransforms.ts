/**
 * An element's `transform` as clip targets, one per `<animateTransform>` type. The import bakes
 * the document's transform into each leaf's geometry, so an animated one moves every shape it
 * reaches by the change from that baked transform, carried in the shape's pose: its box moved
 * and its `transform` turned, scaled or skewed about the box's center.
 */
import { createTarget, type Target } from '@weasel-js/animator';
import { boundsOfPath, type NodeId, type Path, type PoseOverride } from '@weasel-js/core';
import { invert, multiply, rotate, transformPoint, type Affine, type PoseLinear } from '@weasel-js/geom';
import { parseTransform } from './transform';
import type { AnimatedTransform } from './types';
import type { SvgDraftPose } from './draftPose';
import type { SvgClipScene } from './smilGeometry';

/** A shape a transform moves: its node, its pose as the import left it, and the map from the document's coordinates into its frame. */
interface Moved {
  readonly node: NodeId;
  readonly rest: SvgDraftPose;
  readonly frame: Affine;
  readonly frameInverse: Affine;
  readonly ply: PoseOverride<unknown, Record<string, unknown>>;
}

/** The values of each type that leave a point where it is. */
const NEUTRAL: Readonly<Record<string, number[]>> = { translate: [0, 0], scale: [1, 1], rotate: [0, 0, 0], skewX: [0], skewY: [0] };

const quiet = (): void => {};

function frameOf(path: Path, box: SvgDraftPose): Affine {
  const b = boundsOfPath(path);
  const s = b.width > 0 ? box.width / b.width : b.height > 0 ? box.height / b.height : 1;
  return [s, 0, 0, s, box.x - b.x * s, box.y - b.y * s];
}

/** `rest` moved by `by`, a map in its own frame's coordinates: its center carried and its linear part turned into its `transform`. */
function poseMovedBy(rest: SvgDraftPose, by: Affine): SvgDraftPose {
  const cx = rest.x + rest.width / 2;
  const cy = rest.y + rest.height / 2;
  const [x, y] = transformPoint(by, cx, cy);
  const turn = rest.rotation ? rotate(rest.rotation) : null;
  const [a, b, c, d] = rest.transform ?? [1, 0, 0, 1];
  let linear: Affine = multiply([by[0], by[1], by[2], by[3], 0, 0], turn ?? [1, 0, 0, 1, 0, 0]);
  if (turn) linear = multiply(invert(turn)!, linear);
  linear = multiply(linear, [a, b, c, d, 0, 0]);
  const transform: PoseLinear = [linear[0], linear[1], linear[2], linear[3]];
  return { ...rest, x: rest.x + x - cx, y: rest.y + y - cy, transform };
}

/**
 * A maker of transform targets: `target(element, record, nodes)` is the target of one
 * `<animateTransform>` type of `element` (`translate`, `scale`, `rotate`, `skewX`, `skewY`),
 * moving the shape nodes `nodes`. Undefined where none of them is a shape still in the scene.
 */
export function createTransformTargets(scene: SvgClipScene): (element: string, type: string, record: AnimatedTransform, nodes: readonly string[]) => Target<number[]> | undefined {
  const targets = new Map<string, Target<number[]>>();
  const elements = new Map<string, { committed: Map<string, number[]>; shown: Map<string, number[]>; moved: Moved[] }>();

  const movedBy = (record: AnimatedTransform, values: ReadonlyMap<string, number[]>): Affine | null => {
    const now = [...values].reduce<Affine>((m, [type, v]) => multiply(m, parseTransform(`${type}(${v.join(' ')})`, quiet)), [1, 0, 0, 1, 0, 0]);
    const ownInverse = invert(record.own);
    const aboveInverse = invert(record.above);
    if (!ownInverse || !aboveInverse) return null;
    return multiply(record.above, multiply(now, multiply(ownInverse, aboveInverse)));
  };

  return (element, type, record, nodes) => {
    const key = `${element}\u0000${type}`;
    const held = targets.get(key);
    if (held) return held;
    let state = elements.get(element);
    if (!state) {
      const moved: Moved[] = [];
      for (const id of nodes) {
        const n = scene.get(id as NodeId);
        const path = (n?.data as { path?: Path } | undefined)?.path;
        if (!n || !path) continue;
        const frame = frameOf(path, n.pose);
        moved.push({ node: id as NodeId, rest: n.pose, frame, frameInverse: invert(frame)!, ply: {} });
      }
      elements.set(element, state = { committed: new Map(), shown: new Map(), moved });
    }
    const s = state;
    if (s.moved.length === 0 || !Object.hasOwn(NEUTRAL, type)) return undefined;
    const valuesNow = (): Map<string, number[]> => new Map([...s.committed, ...s.shown]);
    const posesFor = (values: ReadonlyMap<string, number[]>): (SvgDraftPose | null)[] => {
      const by = values.size === 0 ? null : movedBy(record, values);
      return s.moved.map((m) => (by ? poseMovedBy(m.rest, multiply(m.frame, multiply(by, m.frameInverse))) : null));
    };
    const target: Target<number[]> = createTarget<number[]>({
      get: () => s.committed.get(type) ?? NEUTRAL[type],
      set(value) {
        s.committed.set(type, value);
        const poses = posesFor(s.committed);
        scene.untracked(() => s.moved.forEach((m, i) => scene.setPose(m.node, poses[i] ?? m.rest)));
      },
      show(value) {
        if (target.active) s.shown.set(type, value);
        else s.shown.delete(type);
        const poses = s.shown.size > 0 ? posesFor(valuesNow()) : [];
        s.moved.forEach((m, i) => {
          const pose = poses[i];
          if (!pose) {
            scene.overrides.clear(m.node, m.ply);
            return;
          }
          m.ply.pose = pose;
          if (!scene.overrides.has(m.node, m.ply)) scene.overrides.set(m.node, m.ply);
        });
      },
      publish: () => scene.overrides.commit(),
    });
    targets.set(key, target);
    return target;
  };
}
