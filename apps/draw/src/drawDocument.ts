import type {
  FillStyle,
  ImageNodeData,
  Path,
  Stroke,
  StyledRun,
  TextStyle,
  TextVerticalAlign
} from '@weasel-js/core';

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
  /** The node's paint — solid, gradient or pattern. `null` is an explicit
   *  "no fill"; absent takes the painter's default. */
  fill?: FillStyle | null;
  /** The whole stroke — paint, width, dash, cap, join, align. */
  stroke?: Stroke | null;
  /** A dropped bitmap, a dropped SVG kept whole, or an imported `<image>` —
   *  what the `kit:image` painter draws. */
  image?: ImageNodeData['image'];
  label?: string;
}

const CONTENT_KEYS: ReadonlySet<string> = new Set<keyof WeaselDrawData>([
  'path', 'text', 'style', 'runs', 'verticalAlign', 'fill', 'stroke', 'image',
]);

/** What a node made from `data`'s node keeps of it: everything but the content
 *  and the paint, which the new node has its own of. */
export function carriedData(data: WeaselDrawData | undefined): WeaselDrawData {
  if (!data) return {};
  return Object.fromEntries(Object.entries(data).filter(([key]) => !CONTENT_KEYS.has(key)));
}

export type WeaselDrawLayer = 'default';
