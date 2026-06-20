import type { BooleanOp, Path, TextStyle } from '@weasel-js/core';

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

