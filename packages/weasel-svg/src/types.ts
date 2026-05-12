/**
 * Public types for `@orochi235/weasel-svg`. The package exposes a flat,
 * discriminated-union node model (`SvgNode`) that mirrors the SVG element
 * tree but uses weasel-native leaf data (`Path`, `Paint`) for geometry and
 * paint.
 *
 * Parsing collapses every `transform="..."` onto its descendants' geometry,
 * so the `SvgNode` tree returned from `parseSvg` never has a non-identity
 * group transform. Consumers may still construct groups with explicit
 * transforms before serializing, in which case the serializer emits a
 * single `matrix(a b c d e f)` on the `<g>`.
 */

import type { Path, Paint } from '@orochi235/weasel';

/**
 * 2x3 affine matrix in column-major form (SVG's `matrix(a b c d e f)`
 * order). Maps `[x', y'] = [a*x + c*y + e, b*x + d*y + f]`.
 */
export type Matrix = readonly [number, number, number, number, number, number];

/** Identity matrix — useful as a default in tests / constructors. */
export const IDENTITY_MATRIX: Matrix = [1, 0, 0, 1, 0, 0];

/**
 * Paint description in the SVG sense — either explicit `none`, a solid
 * color, or a reference to a weasel-native gradient `Paint`. Solid colors
 * are normalized to `#rrggbb` strings; opacity is carried separately so
 * `fill-opacity` and `stroke-opacity` round-trip cleanly.
 */
export type SvgPaint =
  | { kind: 'none' }
  | { kind: 'solid'; color: string; opacity?: number }
  | { kind: 'gradient'; paint: Paint };

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
}

/** Discriminated-union node — the leaf of the public tree. */
export type SvgNode = SvgPathNode | SvgGroupNode;

/** Output of {@link parseSvg}. */
export interface ParseResult {
  nodes: SvgNode[];
  /** Non-fatal notices (unsupported elements, unrecognized attributes). */
  warnings: string[];
}

/** Options for {@link serializeSvg}. */
export interface SerializeOptions {
  /**
   * Override the root `viewBox`. When omitted, the serializer computes
   * a tight bounding box from the supplied nodes.
   */
  viewBox?: { x: number; y: number; width: number; height: number };
  /** Pretty-print with newlines + indentation. Default `false`. */
  pretty?: boolean;
}
