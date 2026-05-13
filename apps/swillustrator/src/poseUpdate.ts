import type { PolygonPath, TextStyle } from '@orochi235/weasel';
import { scalePathToBounds, translatePath } from '@orochi235/weasel';

export type Kind = 'rect' | 'text' | 'path';
export interface BaseObj { id: string; kind: Kind; x: number; y: number; width: number; height: number; rotation?: number }
export interface RectObj extends BaseObj { kind: 'rect'; fill: string; stroke: string; strokeWidth: number }
export interface TextObj extends BaseObj { kind: 'text'; text: string; style?: TextStyle }
export interface PathObj extends BaseObj { kind: 'path'; path: PolygonPath; closed: boolean; fill: string; stroke: string; strokeWidth: number }
export type Obj = RectObj | TextObj | PathObj;

/** Pose, including optional rotation in radians (pivot = unrotated AABB
 *  center). `rotation` left undefined means "do not change"; explicit 0
 *  means "clear rotation". */
export interface Pose { x: number; y: number; width: number; height: number; rotation?: number }

/** Apply a new pose to an Obj, mirroring the shape-aware rules in the
 *  Swillustrator adapter: text rescales fontSize with height, paths rescale
 *  their geometry. Rotation is stored on the resulting Obj. */
export function applyPoseToObj(prev: Obj, pose: Pose): Obj {
  // Decide what rotation to write. `rotation: undefined` in `pose` means
  // "preserve". `rotation: 0` clears.
  const nextRotation = pose.rotation === undefined ? prev.rotation : pose.rotation;
  const rectFields = { x: pose.x, y: pose.y, width: pose.width, height: pose.height, rotation: nextRotation };
  if (prev.kind === 'text' && pose.height !== prev.height) {
    const fontSize = Math.max(8, Math.round(pose.height * 0.7));
    const style = { ...(prev.style ?? {}), fontSize };
    return { ...prev, ...rectFields, style };
  }
  if (prev.kind === 'path') {
    const moved = pose.width !== prev.width || pose.height !== prev.height;
    const path = moved
      ? scalePathToBounds(prev.path, {
          kind: 'rect',
          x: pose.x, y: pose.y,
          width: pose.width, height: pose.height,
        }) as PolygonPath
      : translatePath(prev.path, pose.x - prev.x, pose.y - prev.y) as PolygonPath;
    return { ...prev, ...rectFields, path };
  }
  return { ...prev, ...rectFields };
}
