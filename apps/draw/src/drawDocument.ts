import type {
  BooleanShapeOp,
  ImageNodeData,
  Path,
  Stroke,
  StyledRun,
  TextStyle,
  TextVerticalAlign,
  Fill,
  Inherit,
  PathEffect,
  Scene,
  SceneRegistry,
  ShapeGenerator,
} from '@weasel-js/core';
import { UNION_OF_CHILDREN, unionOfChildren, withPathEffectsRegistry } from '@weasel-js/core';
import { symmetryRegistry } from '@weasel-js/symmetry';

// ─── Document / scene shapes ────────────────────────────────────────────────

/** Pose stored on every leaf — rectangular AABB plus optional rotation
 *  (radians, pivot = unrotated AABB center). Matches the auto-rotation
 *  hook `SceneCanvas.defaultDrawOne` applies for any pose carrying a
 *  non-zero `rotation` field. */
export interface WeaselDrawPose {
  x: number; y: number; width: number; height: number; rotation?: number;
}

/** Data stored on every leaf — kit-native shape consumed by PATH_PAINTER
 *  and the text painter. Tools synthesized by `defaultTools={BUILTIN_TOOL_IDS}`
 *  already produce this shape, so no per-tool `create` overrides are
 *  required. `text` is present on text-tool leaves only. */
export interface WeaselDrawData {
  path?: Path;
  text?: string;
  /** Node-level typography. What the sidebar's Character / Paragraph groups
   *  edit, and what runs inherit from. */
  style?: TextStyle;
  /** Inline styling over `text`. Kept in sync with it by every writer —
   *  `runsToPlainText(runs) === text` — and preferred by the `kit:text`
   *  painter when present. */
  runs?: StyledRun[];
  /** Where the lines sit in the box's height — read by the `kit:text`
   *  painter and the editor, edited beside the Paragraph group. */
  verticalAlign?: TextVerticalAlign;
  /** The node's paint — solid, gradient or pattern. Absent and `null` are
   *  no fill, as `Fill` says; `'inherit'` takes the enclosing group's. */
  fill?: Fill | Inherit | null;
  /** The whole stroke — paint, width, dash, cap, join, align. */
  stroke?: Stroke | Inherit | null;
  /** A dropped bitmap, a dropped SVG kept whole, or an imported `<image>` —
   *  what the `kit:image` painter draws. */
  image?: ImageNodeData['image'];
  /** The parameters a polygon or star was drawn with, which the sidebar
   *  edits and `path` is made again from. */
  generator?: ShapeGenerator;
  /** A live path effect: what this node derives from its sources. */
  pathEffect?: PathEffect;
  /** A boolean group's operation over its children (core's `booleanGroupFields`). */
  boolean?: BooleanShapeOp;
  label?: string;
}

/** The functions a draw document's nodes name by key, for the scene and for
 *  reading a saved document back: a group's hug of its members, a symmetry
 *  group's copies, and the kit's path effects, so they work and a document
 *  holding one saves and reopens. */
export const DRAW_REGISTRY: SceneRegistry<WeaselDrawPose, WeaselDrawData, WeaselDrawLayer> =
  withPathEffectsRegistry<WeaselDrawPose, WeaselDrawData, WeaselDrawLayer>({
    ...(symmetryRegistry as SceneRegistry<WeaselDrawPose, WeaselDrawData, WeaselDrawLayer>),
    derivePose: { [UNION_OF_CHILDREN]: unionOfChildren as never },
  });

const CONTENT_KEYS: ReadonlySet<string> = new Set<keyof WeaselDrawData>([
  'path', 'generator', 'text', 'style', 'runs', 'verticalAlign', 'fill', 'stroke', 'image',
]);

/** What a node made from `data`'s node keeps of it: everything but the content
 *  and the paint, which the new node has its own of. */
export function carriedData(data: WeaselDrawData | undefined): WeaselDrawData {
  if (!data) return {};
  return Object.fromEntries(Object.entries(data).filter(([key]) => !CONTENT_KEYS.has(key)));
}

/** The layer content goes on, and the non-printing one measurements go on. */
export type WeaselDrawLayer = 'default' | 'annotations';

/** Where measurements are kept: drawn on the canvas and saved with the
 *  document, left out of export and of content picking. */
export const ANNOTATION_LAYER: WeaselDrawLayer = 'annotations';

/** The document's layers, content first. */
export const DRAW_LAYERS = [{ id: 'default' }, { id: ANNOTATION_LAYER, annotation: true }] as const satisfies readonly {
  id: WeaselDrawLayer;
  annotation?: boolean;
}[];

export type DrawScene = Scene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;
