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
 *   `<defs>` block with stable ids. It is synchronous: `await warmSvg(nodes)`
 *   first to load the paint kinds and faces it reads on demand.
 *
 * `svgNodesToKitDrafts` lowers a parsed tree to scene nodes the kit's own
 * painters draw, and `svgNodesFromKit` walks a scene back to `SvgNode`s.
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
export { svgNeeds, warmSvg } from './warm';
export { tilePreviewSvg, tilePreviewCssUrl } from './patterns';
export { nativeSvgKind, nativeSvgSpace } from './gradients';
export { evaluateMediaQuery, DEFAULT_MEDIA_ENVIRONMENT, type SvgMediaEnvironment } from './media';
export { evaluateSupports, type SupportsOptions } from './supports';
export {
  unpackSvgFiles,
  svgNodesToKitDrafts,
  fillDataFromSvg,
  strokeDataFromSvg,
  type SvgSceneDraft,
  type SvgDraftBounds,
  type SvgLeafNode,
  type SvgNodesToKitDraftsOptions,
} from './unpack';
export {
  svgNodesFromKit,
  svgLeafFromKit,
  svgImageFromKit,
  svgPaintFromKit,
  svgStrokeFromKit,
  type SvgKitTree,
  type SvgKitTreeNode,
  type SvgKitLeafData,
  type SvgKitPose,
  type SvgNodesFromKitOptions,
} from './fromKit';
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
  SvgImageNode,
  SvgPaint,
  SvgStroke,
  Matrix,
} from './types';
export { IDENTITY_MATRIX } from './types';
