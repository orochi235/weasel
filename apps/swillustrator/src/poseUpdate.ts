import type { BooleanOp, Path, TextStyle } from '@orochi235/weasel';
import { scalePathToBounds, translatePath } from '@orochi235/weasel';

export type ToolKind =
  | 'rect' | 'ellipse' | 'polygon' | 'star' | 'line'
  | 'pen' | 'pencil' | 'text' | 'imported';

/** Non-bounds-derivable shape parameters. Bounds-derived params
 *  (ellipse rx/ry, polygon outer radius, line endpoints) are NOT
 *  stored — they're derived from x/y/width/height. */
export type PathParams =
  | { sides: number }                  // tool === 'polygon'
  | { points: number; ratio: number }; // tool === 'star'

export interface BaseObj {
  id: string;
  tool: ToolKind;
  x: number; y: number; width: number; height: number;
  rotation?: number;
}

export interface PathObj extends BaseObj {
  tool: Exclude<ToolKind, 'text'>;
  path: Path;
  closed: boolean;
  fill: string;
  stroke: string;
  strokeWidth: number;
  params?: PathParams;
  /** Provenance for nodes minted by a boolean op. `tool` for these is
   *  always `'imported'`; the Layers panel uses `producedBy` to render
   *  the op's icon instead of the unknown-tool glyph. */
  producedBy?: BooleanOp;
}

export interface TextObj extends BaseObj {
  tool: 'text';
  text: string;
  style?: TextStyle;
}

export type Obj = PathObj | TextObj;

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
  if (prev.tool === 'text' && pose.height !== prev.height) {
    const fontSize = Math.max(8, Math.round(pose.height * 0.7));
    const style = { ...(prev.style ?? {}), fontSize };
    return { ...prev, ...rectFields, style };
  }
  if (prev.tool !== 'text') {
    // PathObj — narrow via tool discriminator.
    const moved = pose.width !== prev.width || pose.height !== prev.height;
    const path = moved
      ? scalePathToBounds(prev.path, {
          kind: 'rect',
          x: pose.x, y: pose.y,
          width: pose.width, height: pose.height,
        })
      : translatePath(prev.path, pose.x - prev.x, pose.y - prev.y);
    // `tool` and `params` carry through via spread — resize is intentionally
    // tool/params-blind (drift is acceptable per the spec).
    return { ...prev, ...rectFields, path };
  }
  return { ...prev, ...rectFields };
}
