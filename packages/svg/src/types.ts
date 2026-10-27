/**
 * Public types for `@weasel-js/svg`: a node model (`SvgNode`) that mirrors
 * the SVG element tree but uses weasel-native leaf data (`Path`, `Paint`)
 * for geometry and paint.
 */

import { identity, type Affine } from '@weasel-js/geom';
import type { SvgMediaEnvironment } from './media';
import type {
  Path, Paint, MarkerEntry, MarkerRef, PoseLinear, ScreenLength, Stroke, StrokeAlign, StyledRun, TextStyle,
  TextVerticalAlign,
  TextPoseLayout,
  Fill,
  StrokeNib,
  VertexWidth,
  BooleanShapeOp,
} from '@weasel-js/core';

/**
 * Opaque pass-through bag for namespaced XML content. The package does not
 * interpret it; attributes and child elements in a *declared* XML namespace
 * round-trip losslessly through parse → serialize.
 *
 * Keyed by namespace prefix. The URI is the canonical identifier and is
 * supplied via `ParseOptions.namespaces` / `SerializeOptions.namespaces`.
 */
export interface NamespaceMeta {
  [prefix: string]: {
    /** Local-name → string-value map for attributes in this namespace. */
    attrs?: Record<string, string>;
    /** Child elements in this namespace, keyed by local name. An array
     *  because siblings can share a tag. */
    elements?: Record<string, NamespacedElement[]>;
  };
}

/** Opaque structured representation of a namespaced element. */
export interface NamespacedElement {
  /** Attribute local-name → string-value. */
  attrs: Record<string, string>;
  /** Text content, when the element contains only text (no child elements). */
  text?: string;
  /** Nested namespaced children, keyed by local name (recursive). */
  children?: Record<string, NamespacedElement[]>;
}

/**
 * 2x3 affine matrix in SVG's `matrix(a b c d e f)` order, mapping
 * `[x', y'] = [a*x + c*y + e, b*x + d*y + f]`. It is geom's `Affine`, so the
 * two are interchangeable without a conversion.
 */
export type Matrix = Affine;

/** Core's type, re-exported. */
export type { ScreenLength };

/** The identity matrix. */
export const IDENTITY_MATRIX: Matrix = identity();

/**
 * A paint in the SVG sense: explicit `none`, a solid color, or a weasel-native
 * gradient `Paint`. Solid colors are normalized to `#rrggbb` strings, with
 * opacity carried separately.
 */
export type SvgPaint =
  | { kind: 'none' }
  | { kind: 'solid'; color: string; opacity?: number }
  | { kind: 'gradient'; paint: Paint };

/** Stroke description: a paint plus structural line parameters. */
export interface SvgStroke {
  paint: SvgPaint;
  /** World units, or `{ px }` for a width that holds its rendered thickness
   *  however the document is scaled — SVG's `vector-effect="non-scaling-stroke"`. */
  width: ScreenLength;
  opacity?: number;
  /** `stroke-linecap`. Default per SVG spec is `'butt'`. */
  cap?: 'butt' | 'round' | 'square';
  /** `stroke-linejoin`. Default per SVG spec is `'miter'`. SVG's `arcs` / `miter-clip` map to `'miter'` with a warning. */
  join?: 'miter' | 'round' | 'bevel';
  /** `stroke-dasharray` as a flat number array. Odd-length inputs are doubled per SVG spec. */
  dash?: number[];
  /**
   * `stroke-miterlimit`. SVG's default is 4. Weasel's renderer defaults to
   * 10 (Canvas2D) when unset, so parsed strokes without an explicit
   * attribute may render with longer miters than the source SVG intended.
   */
  miterLimit?: number;
  /** The kit stroke's `align`. SVG has no stroke alignment, so the serializer
   *  writes the stroke centered and says so through `onWarn`; the parser
   *  never sets it. */
  align?: StrokeAlign;
  /** `marker-start` / `marker-mid` / `marker-end` as the kit's `MarkerRef`: the
   *  bare `url(#id)` key, or a key with the `size` the serializer writes into a
   *  def of its own. */
  markerStart?: MarkerRef;
  markerMid?: MarkerRef;
  markerEnd?: MarkerRef;
  /** The kit stroke's `vertexWidths` and `nib`. SVG has no variable width, so
   *  the serializer writes such a stroke's outline as a filled shape after the
   *  path, and keeps these in the private namespace for the parser. An entry
   *  of `vertexWidths`, or one side of a pair, that is not a number of zero or
   *  more takes `width`. */
  vertexWidths?: VertexWidth[];
  nib?: StrokeNib;
}

/**
 * Which of a node's paints its own element sets none of, so that it takes the
 * paint of the enclosing `<g>` that does. Its `fill` and `stroke` still hold
 * what that resolves to.
 */
export interface SvgInherits {
  fill?: true;
  /** Set only when the element sets no `stroke-*` or `marker-*` property
   *  either: the stroke is taken whole. */
  stroke?: true;
}

/**
 * Leaf node: a path geometry plus fill/stroke. Other shapes (`<rect>`,
 * `<ellipse>`, etc.) are lowered to this on parse.
 */
export interface SvgPathNode {
  kind: 'path';
  path: Path;
  fill: SvgPaint;
  stroke?: SvgStroke;
  inherits?: SvgInherits;
  /** Element-level opacity (`opacity="..."`), 0..1. */
  opacity?: number;
  /** Element-level rotation in **radians**, pivoting around the AABB
   *  center of the underlying `path` geometry. Emitted as SVG
   *  `transform="rotate(angleDegrees cx cy)"`. */
  rotation?: number;
  /** Kept by `ParseOptions.keepHidden` from content SVG does not render:
   *  `display="none"` here, or a leaf under `visibility="hidden"`. Written
   *  back as `display="none"`. */
  hidden?: boolean;
  /** Opaque per-element bag for declared namespaces. See `NamespaceMeta`. */
  meta?: NamespaceMeta;
}

/**
 * Group node: an SVG `<g>`. Parsing collapses any `transform` attribute onto
 * the descendants' geometry, so a parsed group never has one. On serialize, a
 * non-identity `transform` is emitted as `matrix(a b c d e f)`.
 */
export interface SvgGroupNode {
  kind: 'group';
  children: SvgNode[];
  transform?: Matrix;
  /** Clips the group's contents. Serializes to a `<clipPath>` def plus
   *  `clip-path="url(#id)"`, and lives in the same space as `children` —
   *  SVG applies the group's own `transform` to the clip as well.
   *  A `<clipPath>` of more than one shape parses back as no clip: SVG
   *  unions them and a `Path` holds one outline. */
  clip?: Path;
  opacity?: number;
  /** The fill its children take when they set none — written as the group's
   *  own `fill`. Absent when neither it nor an enclosing group sets one. */
  fill?: SvgPaint;
  /** As `fill`, for the stroke; absent too when the one in effect is none. */
  stroke?: SvgStroke;
  inherits?: SvgInherits;
  /** Kept by `ParseOptions.keepHidden` from content SVG does not render:
   *  `display="none"` here, or a leaf under `visibility="hidden"`. Written
   *  back as `display="none"`. */
  hidden?: boolean;
  /** Set on the `<g>` of a boolean group's children, which follows the path
   *  the group draws: the operation that path is of them. Written as
   *  `data-weasel-boolean`; `parseSvg` keeps such a `<g>` hidden even without
   *  `keepHidden`. */
  boolean?: BooleanShapeOp;
  /** Opaque per-element bag for declared namespaces. See `NamespaceMeta`. */
  meta?: NamespaceMeta;
}

/**
 * Text leaf node: a bounding box plus text content, optional per-range
 * `runs`, and an optional `TextStyle` for the node-wide defaults.
 *
 * Native `<text>` has no width or height, so the serializer writes the box
 * as `data-weasel-width` / `data-weasel-height`. External SVG text, lacking
 * them, imports with the width the kit's text layout measures — an em-based
 * estimate when no registered font can — and
 * `height = fontSize * lineHeight * (lineCount || 1)`.
 *
 * `x` here is always the box's left edge. In the SVG it is the
 * `text-anchor` point, and the parser and serializer convert between them.
 */
export interface SvgTextNode {
  kind: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  /** Plain text. When `runs` is set, `runsToPlainText(runs)` must equal `text`. */
  text: string;
  /** Per-range styling. */
  runs?: StyledRun[];
  /** Node-wide typography. */
  style?: TextStyle;
  /** Where the laid-out text sits inside the box — `kit:text`'s
   *  `data.verticalAlign`. SVG text has no box to align in, so this rides in
   *  `data-weasel-vertical-align` and other readers draw the text top-aligned. */
  verticalAlign?: TextVerticalAlign;
  /**
   * Node-wide glyph paint, as the kit's `Fill` / `Stroke` rather than
   * the path nodes' `SvgPaint`. `StyledRun.fill` / `.stroke` override these
   * per range.
   *
   * `null` is SVG's `fill="none"`: outline-only text, painted by its stroke
   * alone. Absent takes the default black.
   */
  fill?: Fill | null;
  stroke?: Stroke;
  inherits?: SvgInherits;
  /** Element-level opacity (`opacity="..."`), 0..1. */
  opacity?: number;
  /** Element-level rotation in **radians**, pivoting around the unrotated
   *  AABB center `(x + width/2, y + height/2)`. Emitted as SVG
   *  `transform="rotate(angleDegrees cx cy)"`. */
  rotation?: number;
  /** The skew or per-axis scale the box, `rotation`, and flips cannot hold,
   *  applied about the box center inside the rotation; see `PoseLinear`.
   *  With one, the element is written with its whole frame as a
   *  `transform="matrix(...)"`. */
  transform?: PoseLinear;
  /** Kept by `ParseOptions.keepHidden` from content SVG does not render:
   *  `display="none"` here, or a leaf under `visibility="hidden"`. Written
   *  back as `display="none"`. */
  hidden?: boolean;
  /** Opaque per-element bag for declared namespaces. See `NamespaceMeta`. */
  meta?: NamespaceMeta;
}

/**
 * Raster-image leaf — an SVG `<image>`. `href` is the element's `href` (or
 * legacy `xlink:href`) verbatim: an external URL or a `data:` URI. The
 * package neither fetches nor decodes it.
 *
 * SVG's `preserveAspectRatio` is not modeled; the box is taken literally.
 *
 * With a `source` rect or a flip, the element is written as a `<g
 * data-weasel-image>` holding a nested `<svg>` viewport at the box, whose
 * `viewBox` is the source window over a unit-square `<image>` — plain SVG 1.1,
 * which `parseSvg` reads back as one image node.
 */
export interface SvgImageNode {
  kind: 'image';
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The part of the bitmap drawn into the box, as fractions of the bitmap's
   *  width and height from its top-left. Omitted draws the whole bitmap.
   *  Fractions rather than bitmap pixels because this package never decodes
   *  the image, so it cannot know its size. */
  source?: { x: number; y: number; width: number; height: number };
  /** Mirror the drawn region within the box, as `ImageDrawCommand` does. The
   *  box does not move. */
  flipX?: boolean;
  flipY?: boolean;
  /** Element-level opacity (`opacity="..."`), 0..1. */
  opacity?: number;
  /** Element-level rotation in **radians**, pivoting around the unrotated
   *  AABB center `(x + width/2, y + height/2)`. Emitted as SVG
   *  `transform="rotate(angleDegrees cx cy)"`. */
  rotation?: number;
  /** The skew or per-axis scale the box, `rotation`, and flips cannot hold,
   *  applied about the box center inside the rotation; see `PoseLinear`.
   *  With one, the element is written with its whole frame as a
   *  `transform="matrix(...)"`. */
  transform?: PoseLinear;
  /** Kept by `ParseOptions.keepHidden` from content SVG does not render:
   *  `display="none"` here, or a leaf under `visibility="hidden"`. Written
   *  back as `display="none"`. */
  hidden?: boolean;
  /** Opaque per-element bag for declared namespaces. See `NamespaceMeta`. */
  meta?: NamespaceMeta;
}

/** Any node of a parsed SVG tree. */
export type SvgNode = SvgPathNode | SvgGroupNode | SvgTextNode | SvgImageNode;

/** Options for {@link parseSvg}. */
export interface ParseOptions {
  /**
   * Map of prefix → URI for XML namespaces the caller wants surfaced.
   * Attributes and child elements in a declared namespace are collected
   * into `SvgNode.meta` (per element) or `ParseResult.documentMeta` (root).
   * Content in an undeclared namespace is dropped.
   */
  namespaces?: Record<string, string>;
  /**
   * The media `@media` rules and `<style media>` are evaluated against. A
   * parse is one static render: by default a `screen` whose viewport is the
   * root's `width` / `height` (else its `viewBox`, else 300 × 150), with a
   * light color scheme and no hover or pointer. Fields given here replace
   * those defaults.
   */
  media?: Partial<SvgMediaEnvironment>;
  /**
   * Keep `display="none"` and `visibility="hidden"` content, each node marked
   * `hidden`, so a file's hidden layers survive the import. By default it is
   * left out, as a renderer leaves it out.
   */
  keepHidden?: boolean;
}

/** Output of {@link parseSvg}. */
export interface ParseResult {
  nodes: SvgNode[];
  /** Non-fatal notices (unsupported elements, unrecognized attributes). */
  warnings: string[];
  /** The root's namespaced attributes and children, for declared namespaces. */
  documentMeta?: NamespaceMeta;
  /** Root `viewBox` attribute, parsed from `"x y width height"`. */
  viewBox?: { x: number; y: number; width: number; height: number };
  /** Root `width` attribute in user units when present, an absolute CSS unit converted at 96 per inch. */
  width?: number;
  /** Root `height` attribute in user units when present, converted as `width` is. */
  height?: number;
  /** Text content of the first `<title>` child of `<svg>`, when present. */
  title?: string;
  /**
   * An entry for each document `<marker>` a stroke references under a key the
   * marker registry does not know, keyed as the strokes in `nodes` now name
   * them. Nothing draws them until they are registered (`registerMarker`),
   * which `unpackSvgFiles` does.
   */
  markers?: MarkerEntry[];
}

/** Options for {@link serializeSvg}. */
export interface SerializeOptions {
  /** The root `viewBox`. Default: a tight bounding box around the nodes. */
  viewBox?: { x: number; y: number; width: number; height: number };
  /**
   * Called for what the document cannot carry the way weasel draws it: a
   * paint SVG cannot express (a pattern carrying a `TextureHandle` instead of
   * a `TilePatternSpec`), a stroke aligned off its edge, text that wraps or
   * sits lower than the top of its box. Each message is said once per call.
   * Without this the loss is silent.
   */
  onWarn?: (message: string) => void;
  /** Emit `width="..."` on the root `<svg>`. */
  width?: number;
  /** Emit `height="..."` on the root `<svg>`. */
  height?: number;
  /** Emit `<title>` as the first child of the root `<svg>`. Empty strings are skipped. */
  title?: string;
  /**
   * Map of prefix → URI for XML namespaces to declare on the root `<svg>`.
   * Only `documentMeta` and `node.meta` entries under a declared prefix are written.
   */
  namespaces?: Record<string, string>;
  /**
   * Per-document namespaced extras: `attrs` go on the root `<svg>`, and
   * `elements` become children placed immediately before any geometry.
   */
  documentMeta?: NamespaceMeta;
  /**
   * Put each element on its own line, indented two spaces per level. A
   * `<text>` element, and any element holding character data, stays on one
   * line, since whitespace inside it is content.
   */
  pretty?: boolean;
  /**
   * The lines a text node lays out into — pass core's `layoutTextPose`, the
   * layout the renderer draws with. With it, each line is written as a
   * `<tspan>` at the layout's own `x` and baseline `y`, a justified line
   * gives each word its own `x`, and a line holding a larger run is pitched
   * as the renderer pitches it, so a reader that cannot wrap draws the lines
   * where weasel does. A node it returns nothing for, or lays out to zero
   * width because no face could measure it, is written without it: one line
   * per hard break, at the node's own pitch. Fonts it reads must have loaded;
   * `warmSvg(nodes, { textLayout })` loads them.
   */
  textLayout?: (node: SvgTextNode) => TextPoseLayout | null | undefined;
}
