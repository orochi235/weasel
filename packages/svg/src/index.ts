/**
 * `@weasel-js/svg` — SVG ↔ weasel interop.
 *
 * - `parseSvg(svg)` lowers an SVG document to a `SvgNode[]` tree. Unsupported
 *   elements and attributes produce `warnings[]` entries instead of throwing.
 * - `serializeSvg(nodes, opts?)` emits an SVG document string. It is
 *   synchronous: `await warmSvg(nodes)` first to load the paint kinds and
 *   faces it reads on demand.
 * - `svgNodesToKitDrafts` lowers a parsed tree to scene nodes, and
 *   `svgNodesFromKit` walks a scene back to `SvgNode`s.
 * - `unpackSvgFiles` plugs into core's ingestion pipeline:
 *   `<SceneCanvas ingestion={{ svg: { unpack: unpackSvgFiles } }}>`.
 *
 * See README for the supported element / attribute matrix.
 *
 * @packageDocumentation
 */

export { parseSvg } from './parse';
export { serializeSvg } from './serialize';
export { serializePathD } from './path-serializer';
export { escapeAttr, escapeText } from './xmlEscape';
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
  type SvgLeafNode,
  type SvgNodesToKitDraftsOptions,
} from './unpack';
export type { SvgDraftBounds, SvgDraftPose } from './draftPose';
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
