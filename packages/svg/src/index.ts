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
 * `unpackSvgFiles` bridges the two into `@weasel-js/core`'s ingestion
 * pipeline — pass it as `<SceneCanvas ingestion={{ svg: { unpack:
 * unpackSvgFiles } }}>`. It lives here, not in core, because core would
 * otherwise have to import this package's parser while this package imports
 * core's path/paint model, leaving the two mutually dependent.
 *
 * See README for the supported element / attribute matrix.
 */

export { parseSvg } from './parse';
export { serializeSvg } from './serialize';
export {
  unpackSvgFiles,
  svgNodesToKitDrafts,
  type SvgSceneDraft,
  type SvgDraftBounds,
} from './unpack';
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
