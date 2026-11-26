/**
 * A shape's geometry attributes as clip targets: `r`, `cx`, `width`, `points`, `d` and the rest a
 * shape takes. A sampled value is lowered as the parse lowered the shape, through the same matrix,
 * then into the node's frame. A node draws its stored path fitted to its pose's box, so the value
 * on screen is shown as an override's `path`, drawn where it is, and a committed one writes the
 * path and the box together.
 */
import { createTarget, type Target, type TargetAxes } from '@weasel-js/animator';
import { boundsOfPath, transformPath, type NodeId, type Path, type PoseOverride, type PoseOverrides } from '@weasel-js/core';
import { lerp, type Affine, type Rect } from '@weasel-js/geom';
import { shapePath, type ShapeGeometry } from './lowerLeaf';
import type { AnimatedShape } from './types';
import type { SvgDraftPose } from './draftPose';

/** The part of a scene a geometry target reads and writes. */
export interface GeometryScene {
  readonly overrides: PoseOverrides<unknown, unknown>;
  get(id: NodeId): { pose: SvgDraftPose; data: unknown } | undefined;
  update(id: NodeId, patch: { data: never }): void;
  setPose(id: NodeId, pose: never): void;
  untracked<T>(fn: () => T): T;
}

type Value = number | number[] | string;

/** One element's geometry as its targets move it: committed attribute values, the ones shown, and the one ply showing them. */
interface Shape {
  readonly committed: Record<string, number | string>;
  readonly shown: Map<string, Value>;
  readonly ply: PoseOverride<unknown, unknown>;
  /** From the document's coordinates, where the parse put the path, into the node's frame. */
  readonly frame: Affine;
}

const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi;

/** A path string's numbers as axes, put back into its own commands: what moves a `d` whose
 *  values share the commands of the one it starts from, as SMIL interpolates one. */
export function pathDataAxes(template: string): TargetAxes<string> {
  const gaps = template.split(NUMBER);
  return {
    count: gaps.length - 1,
    to: (d) => (d.match(NUMBER) ?? []).map(Number),
    from: (n) => gaps.reduce((out, gap, i) => (i === 0 ? gap : `${out}${+n[i - 1].toFixed(6)}${gap}`), ''),
  };
}

/** `from` to `to` at `t`, number by number, where both have the same commands; `from` until halfway where not. */
export function lerpPathData(from: string, to: string, t: number): string {
  const a = from.match(NUMBER) ?? [];
  const b = to.match(NUMBER) ?? [];
  const gaps = from.split(NUMBER);
  if (a.length !== b.length || gaps.join() !== to.split(NUMBER).join()) return t < 0.5 ? from : to;
  return gaps.reduce((out, gap, i) => (i === 0 ? gap : `${out}${+lerp(Number(a[i - 1]), Number(b[i - 1]), t).toFixed(6)}${gap}`), '');
}

/** The map from `path`'s own bounds to `box`, scaled alike on both axes, as an import places a shape. */
function frameOf(path: Path, box: Rect): Affine {
  const b = boundsOfPath(path);
  const s = b.width > 0 ? box.width / b.width : b.height > 0 ? box.height / b.height : 1;
  return [s, 0, 0, s, box.x - b.x * s, box.y - b.y * s];
}

const quiet = (): void => {};

/**
 * A maker of geometry targets for the shapes of one import: `target(nodeId, shape, attribute)`
 * is the target of one attribute of the shape drafted as node `nodeId`, the same one each call.
 * Undefined where the node is gone or the shape does not take the attribute.
 */
export function createGeometryTargets(scene: GeometryScene): (id: string, shape: AnimatedShape, attribute: string) => Target<Value> | undefined {
  const shapes = new Map<string, Shape>();
  const targets = new Map<string, Target<Value>>();

  const lowered = (shape: AnimatedShape, g: ShapeGeometry): Path | null => shapePath(shape.tag, g, shape.matrix, quiet);

  const reshow = (id: NodeId, s: Shape, shape: AnimatedShape): void => {
    if (s.shown.size === 0) {
      scene.overrides.clear(id, s.ply);
      return;
    }
    const g: Record<string, number | string> = { ...s.committed };
    for (const [k, v] of s.shown) g[k] = Array.isArray(v) ? v.join(' ') : v;
    const path = lowered(shape, g);
    if (!path) return;
    s.ply.path = transformPath(path, s.frame);
    if (!scene.overrides.has(id, s.ply)) scene.overrides.set(id, s.ply);
  };

  return (id, shape, attribute) => {
    const nid = id as NodeId;
    const key = `${id}\u0000${attribute}`;
    const held = targets.get(key);
    if (held && (held.active || scene.get(nid))) return held;
    const node = scene.get(nid);
    const data = node?.data as { path?: Path } | undefined;
    if (!node || !data?.path || !Object.hasOwn(shape.geometry, attribute)) return undefined;
    let s = shapes.get(id);
    if (!s) shapes.set(id, s = { committed: { ...shape.geometry }, shown: new Map(), ply: {}, frame: frameOf(data.path, node.pose) });
    const state = s;
    const start = state.committed[attribute];
    const asValue = (v: number | string): Value => (attribute === 'points' ? String(v).trim().split(/[\s,]+/).map(Number) : v);
    const target: Target<Value> = createTarget<Value>({
      get: () => asValue(state.committed[attribute]),
      set(value) {
        state.committed[attribute] = Array.isArray(value) ? value.join(' ') : value;
        const n = scene.get(nid);
        const path = lowered(shape, state.committed);
        if (!n || !path) return;
        const box = boundsOfPath(transformPath(path, state.frame));
        scene.untracked(() => {
          scene.update(nid, { data: { ...(n.data as object), path } as never });
          scene.setPose(nid, { ...n.pose, x: box.x, y: box.y, width: box.width, height: box.height } as never);
        });
      },
      axes: (typeof start === 'string' && attribute === 'd' ? pathDataAxes(start) : undefined) as TargetAxes<Value> | undefined,
      show(value) {
        if (target.active) state.shown.set(attribute, value);
        else state.shown.delete(attribute);
        reshow(nid, state, shape);
      },
      publish: () => scene.overrides.commit(),
    });
    targets.set(key, target);
    return target;
  };
}
