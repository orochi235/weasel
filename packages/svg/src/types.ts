/**
 * Public types for `@weasel-js/svg`. The package exposes a flat,
 * discriminated-union node model (`SvgNode`) that mirrors the SVG element
 * tree but uses weasel-native leaf data (`Path`, `FillStyle`) for geometry and
 * paint.
 *
 * Parsing collapses every `transform="..."` onto its descendants' geometry,
 * so the `SvgNode` tree returned from `parseSvg` never has a non-identity
 * group transform. Consumers may still construct groups with explicit
 * transforms before serializing, in which case the serializer emits a
 * single `matrix(a b c d e f)` on the `<g>`.
 */

import type { Path, FillStyle, Stroke, StyledRun, TextStyle } from '@weasel-js/core';

/**
 * Opaque pass-through bag for namespaced XML content.
 *
 * weasel-svg does not interpret the contents — it only ensures that any
 * attributes or child elements in a *declared* XML namespace round-trip
 * losslessly through parse → serialize. Consumers (e.g. an app-specific
 * bridge layer) hang their domain semantics off this structure.
 *
 * Keyed by namespace prefix (the prefix is a write-time choice; the URI
 * is the canonical identifier and is supplied via `ParseOptions.namespaces`
 * / `SerializeOptions.namespaces`).
 */
export interface NamespaceMeta {
  [prefix: string]: {
    /** Local-name → string-value map for attributes in this namespace. */
    attrs?: Record<string, string>;
    /**
     * Child elements in this namespace, keyed by local name. Each entry
     * is an array because a namespace can host multiple sibling elements
     * with the same tag (e.g. `<wd:layer/><wd:layer/>`).
     */
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
 * 2x3 affine matrix in column-major form (SVG's `matrix(a b c d e f)`
 * order). Maps `[x', y'] = [a*x + c*y + e, b*x + d*y + f]`.
 */
export type Matrix = readonly [number, number, number, number, number, number];

/** Identity matrix — useful as a default in tests / constructors. */
export const IDENTITY_MATRIX: Matrix = [1, 0, 0, 1, 0, 0];

/**
 * FillStyle description in the SVG sense — either explicit `none`, a solid
 * color, or a reference to a weasel-native gradient `FillStyle`. Solid colors
 * are normalized to `#rrggbb` strings; opacity is carried separately so
 * `fill-opacity` and `stroke-opacity` round-trip cleanly.
 */
export type SvgPaint =
  | { kind: 'none' }
  | { kind: 'solid'; color: string; opacity?: number }
  | { kind: 'gradient'; paint: FillStyle };

/** Stroke description: a paint plus structural line parameters. */
export interface SvgStroke {
  paint: SvgPaint;
  width: number;
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
}

/**
 * Leaf node: a path geometry plus fill/stroke. All other v1 shapes
 * (`<rect>`, `<ellipse>`, etc.) are lowered to this representation on
 * parse — `<rect>` uses weasel's `RectPath` fast-path subtype when
 * possible, everything else becomes a `PolygonPath`.
 */
export interface SvgPathNode {
  kind: 'path';
  path: Path;
  fill: SvgPaint;
  stroke?: SvgStroke;
  /** Element-level opacity (`opacity="..."`), 0..1. */
  opacity?: number;
  /** Element-level rotation in **radians**, pivoting around the AABB
   *  center of the underlying `path` geometry. Emitted as SVG
   *  `transform="rotate(angleDegrees cx cy)"`. */
  rotation?: number;
  /** Opaque per-element bag for declared namespaces. See `NamespaceMeta`. */
  meta?: NamespaceMeta;
}

/**
 * Group node: an SVG `<g>`. On parse, `transform` is always omitted (any
 * `transform` attribute is collapsed onto descendants' geometry). On
 * serialize, a non-identity `transform` is emitted as
 * `matrix(a b c d e f)`.
 */
export interface SvgGroupNode {
  kind: 'group';
  children: SvgNode[];
  transform?: Matrix;
  opacity?: number;
  /** Opaque per-element bag for declared namespaces. See `NamespaceMeta`. */
  meta?: NamespaceMeta;
}

/**
 * Width given to an external `<text>` that carries no `data-weasel-width`:
 * large enough that line wrapping never fires, since SVG text flows from a
 * baseline and the source says nothing about a box.
 *
 * It is a wrap sentinel, not a measurement. Anything that treats a text
 * node's width as geometry — a union AABB, a fit-clamp — has to recognize it
 * and substitute an estimate, or one text node swamps the whole file.
 */
export const UNBOUNDED_TEXT_WIDTH = 99999;

/**
 * Text leaf node. Mirrors the kit's `TextPose` shape — a bounding box plus
 * text content, optional rich-text `runs` (per-range styling), and an
 * optional `TextStyle` for the node-wide defaults.
 *
 * Note on SVG text geometry: native `<text>` flows from a baseline; it
 * doesn't have width/height attributes. The serializer emits
 * `dominant-baseline="text-before-edge"` so `y` is the top of the text
 * box, plus `data-weasel-width` / `data-weasel-height` so weasel's
 * explicit box dimensions round-trip losslessly. External SVG text
 * (lacking the data-* attrs) imports with estimated dimensions —
 * {@link UNBOUNDED_TEXT_WIDTH} and
 * `height = fontSize * lineHeight * (lineCount || 1)`.
 */
export interface SvgTextNode {
  kind: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  /** Plain text. When `runs` is set, `runsToPlainText(runs)` must equal `text`. */
  text: string;
  /** Optional per-range styling — same shape as `TextPose.runs`. */
  runs?: StyledRun[];
  /** Node-wide typography. Defaults applied at render time via `resolveTextStyle`. */
  style?: TextStyle;
  /**
   * Node-wide glyph paint, the `FillStyle` / `Stroke` a kit text node holds
   * in `data.fill` / `data.stroke`. Not `SvgPaint`, which is the path
   * nodes' shape — a text paint reaches the renderer through the runs, and
   * `StyledRun.fill` / `.stroke` override these per range.
   */
  fill?: FillStyle;
  stroke?: Stroke;
  /** Element-level opacity (`opacity="..."`), 0..1. */
  opacity?: number;
  /** Element-level rotation in **radians**, pivoting around the unrotated
   *  AABB center `(x + width/2, y + height/2)`. Emitted as SVG
   *  `transform="rotate(angleDegrees cx cy)"`. */
  rotation?: number;
  /** Opaque per-element bag for declared namespaces. See `NamespaceMeta`. */
  meta?: NamespaceMeta;
}

/**
 * Raster-image leaf — an SVG `<image>`. `href` is the element's `href` (or
 * legacy `xlink:href`) verbatim: an external URL or a `data:` URI. The
 * package neither fetches nor decodes it, so an external URL round-trips as
 * a reference and only resolves when something downstream loads it.
 *
 * SVG's `preserveAspectRatio` is not modeled; the box is taken literally.
 */
export interface SvgImageNode {
  kind: 'image';
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Element-level opacity (`opacity="..."`), 0..1. */
  opacity?: number;
  /** Element-level rotation in **radians**, pivoting around the unrotated
   *  AABB center `(x + width/2, y + height/2)`. Emitted as SVG
   *  `transform="rotate(angleDegrees cx cy)"`. */
  rotation?: number;
  /** Opaque per-element bag for declared namespaces. See `NamespaceMeta`. */
  meta?: NamespaceMeta;
}

/** Discriminated-union node — the leaf of the public tree. */
export type SvgNode = SvgPathNode | SvgGroupNode | SvgTextNode | SvgImageNode;

/** Options for {@link parseSvg}. */
export interface ParseOptions {
  /**
   * Map of prefix → URI for XML namespaces the caller wants surfaced.
   * Attributes / child elements in any declared namespace are collected
   * into `SvgNode.meta` (per element) or `ParseResult.documentMeta` (root).
   * Undeclared namespaces are preserved in the DOM but not promoted into
   * the structured `meta` bag; they are silently dropped at serialize time.
   */
  namespaces?: Record<string, string>;
}

/** Output of {@link parseSvg}. */
export interface ParseResult {
  nodes: SvgNode[];
  /** Non-fatal notices (unsupported elements, unrecognized attributes). */
  warnings: string[];
  /**
   * Opaque per-document bag for declared namespaces. Holds root-level
   * namespaced attributes (`documentMeta.<prefix>.attrs`) and namespaced
   * root children (`documentMeta.<prefix>.elements`).
   */
  documentMeta?: NamespaceMeta;
  /** Root `viewBox` attribute, parsed from `"x y width height"`. */
  viewBox?: { x: number; y: number; width: number; height: number };
  /** Root `width` attribute, parsed as a unitless number when present. */
  width?: number;
  /** Root `height` attribute, parsed as a unitless number when present. */
  height?: number;
  /** Text content of the first `<title>` child of `<svg>`, when present. */
  title?: string;
}

/** Options for {@link serializeSvg}. */
export interface SerializeOptions {
  /**
   * Override the root `viewBox`. When omitted, the serializer computes
   * a tight bounding box from the supplied nodes.
   */
  viewBox?: { x: number; y: number; width: number; height: number };
  /**
   * Called for paint that can't be expressed in SVG and is dropped — a
   * conic gradient, or a pattern carrying a `TextureHandle` instead of a
   * `TilePatternSpec`. Without this the loss is silent.
   */
  onWarn?: (message: string) => void;
  /** Emit `width="..."` on the root `<svg>`. */
  width?: number;
  /** Emit `height="..."` on the root `<svg>`. */
  height?: number;
  /**
   * Emit `<title>...</title>` as the first child of the root `<svg>`. The
   * value is XML-escaped on output. Empty strings are skipped.
   */
  title?: string;
  /**
   * Map of prefix → URI for XML namespaces to declare on the root
   * `<svg>`. The serializer reads `documentMeta[prefix]` and
   * `node.meta[prefix]` to write the actual attributes and elements.
   */
  namespaces?: Record<string, string>;
  /**
   * Opaque per-document namespaced extras. Each `<prefix>.attrs` becomes
   * `<prefix>:<name>="..."` attributes on the root `<svg>`. Each
   * `<prefix>.elements[localName]` becomes `<prefix>:<localName>...>`
   * children placed immediately before any geometry.
   */
  documentMeta?: NamespaceMeta;
  /** Pretty-print with newlines + indentation. Default `false`. */
  pretty?: boolean;
}
