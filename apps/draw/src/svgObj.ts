import type { BooleanOp, ImageNodeData, Path, Stroke, StyledRun, TextStyle, TextVerticalAlign, Fill, Inherit } from '@weasel-js/core';

export type ToolKind =
  | 'rect' | 'ellipse' | 'polygon' | 'star' | 'line'
  | 'pen' | 'pencil' | 'text' | 'image' | 'imported';

/** Non-bounds-derivable shape parameters. Bounds-derived params
 *  (ellipse rx/ry, polygon outer radius, line endpoints) are NOT
 *  stored — they're derived from x/y/width/height. `rotation` is the
 *  first vertex's angle inside the node's own rotation; a file without it
 *  imports as plain geometry. */
export type PathParams =
  | { sides: number; rotation?: number }                  // tool === 'polygon'
  | { points: number; ratio: number; rotation?: number }; // tool === 'star'

/** The tools whose objects are a `PathObj`. */
export type PathToolKind = Exclude<ToolKind, 'text' | 'image'>;

export interface BaseObj {
  id: string;
  tool: ToolKind;
  x: number; y: number; width: number; height: number;
  rotation?: number;
}

export interface PathObj extends BaseObj {
  tool: PathToolKind;
  path: Path;
  /** The object's paint — solid, gradient or pattern. A non-solid one is
   *  emitted by the SVG serializer as a `<defs>` entry. `null` is unfilled. */
  fill: Fill | Inherit | null;
  /** The whole stroke — paint, width, dash, cap, join. `null` is unstroked. */
  stroke: Stroke | Inherit | null;
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
  /** Inline styling over `text`; `runsToPlainText(runs) === text`. */
  runs?: StyledRun[];
  /** Glyph paint. Not part of `style` — a text node paints from the same
   *  `data.fill` / `data.stroke` every other node kind paints from. Read as
   *  SVG reads it: `null` is `fill="none"`, and absent is SVG's initial black,
   *  which a text node built from this writes out. */
  fill?: Fill | Inherit | null;
  stroke?: Stroke | Inherit;
  /** Where the lines sit in the box's height. Absent is the top. */
  verticalAlign?: TextVerticalAlign;
}

/** A bitmap (or embedded SVG) drawn into its box by the kit's image painter. */
export interface ImageObj extends BaseObj {
  tool: 'image';
  image: ImageNodeData['image'];
}

export type Obj = PathObj | TextObj | ImageObj;

/** Pose, including optional rotation in radians (pivot = unrotated AABB
 *  center). `rotation` left undefined means "do not change"; explicit 0
 *  means "clear rotation". */
export interface Pose { x: number; y: number; width: number; height: number; rotation?: number }

