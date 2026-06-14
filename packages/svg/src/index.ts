/**
 * `@weasel-js/svg` — SVG ↔ weasel interop.
 *
 * Two entry points:
 * - `parseSvg(svg)` lowers an SVG document to a `SvgNode[]` tree of
 *   weasel-native shapes (paths, fills, strokes). Transforms are
 *   collapsed onto leaf geometry. Unsupported elements / attributes
 *   produce `warnings[]` entries instead of throwing.
 * - `serializeSvg(nodes, opts?)` emits an SVG document string. Every
 *   leaf serializes as a `<path>`; gradients are gathered into a single
 *   `<defs>` block with stable ids.
 *
 * See README for the supported element / attribute matrix.
 */

export { parseSvg } from './parse';
export { serializeSvg } from './serialize';
export type {
  NamespaceMeta,
  NamespacedElement,
  ParseOptions,
  ParseResult,
  SerializeOptions,
  SvgNode,
  SvgGroupNode,
  SvgPathNode,
  SvgTextNode,
  SvgPaint,
  SvgStroke,
  Matrix,
} from './types';
export { IDENTITY_MATRIX } from './types';
