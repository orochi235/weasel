import { sceneBoxFrames, sceneUnitScopes, unitFrameAt, type NodeId, type Scene, type UnitScope } from '@weasel-js/core';
import { transformPoint } from '@weasel-js/geom';

type Point = { x: number; y: number };
type AnyScene = Scene<unknown, string, unknown>;

/** The frame a ruler reads in: its unit scopes, and where it reads 0. */
export interface RulerFrame {
  /** The node declaring the frame's scope, or `null` for the document. */
  id: NodeId | null;
  /** Its unit scopes, outermost first. */
  scopes: UnitScope[];
  /** The world point that reads 0 on both rulers. */
  origin: Point;
}

/** The document's frame: the root scope alone, read from `origin`. */
export function documentRulerFrame(root: UnitScope, origin: Point = { x: 0, y: 0 }): RulerFrame {
  return { id: null, scopes: [root], origin };
}

/**
 * Which frame a ruler reads in at a world point: built once over `scene` as
 * it stands, it gives the topmost node declaring a unit scope whose drawn box
 * holds the point (`unitFrameAt`), with its scope chain and its box's own
 * origin, or the document's frame outside them all. The rulers run along the
 * view's axes, so a frame turned in the world is read along those axes from
 * its turned origin.
 */
export function rulerFrameAt(scene: AnyScene, root: UnitScope, origin?: Point): (p: Point) => RulerFrame {
  const frameAt = unitFrameAt(scene);
  const boxes = sceneBoxFrames(scene);
  const doc = documentRulerFrame(root, origin);
  return (p) => {
    const id = frameAt(p);
    const box = id === null ? null : boxes(id);
    if (id === null || box === null) return doc;
    const [x, y] = transformPoint(box, 0, 0);
    return { id, scopes: sceneUnitScopes(scene, id, root, { inclusive: true }), origin: { x, y } };
  };
}
