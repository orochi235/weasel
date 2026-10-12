/**
 * Bridge between WeaselDraw's `Obj` discriminated union (`PathObj |
 * TextObj | ImageObj`, discriminated by `tool`) and `@weasel-js/svg`'s
 * `SvgNode` discriminated union, layered over the package's own
 * `svgNodesFromKit` / `svgNodesToKitDrafts` walks. What it adds is the `wd:`
 * namespace. An `Obj` exists only in transit between a file and the scene:
 * `leafToObj` in `svgExport.ts` makes one, `leafOfObj` in `svgImport.ts`
 * unmakes one, and the scene never stores it.
 *
 * `tool` and `params` ride on `meta.wd.attrs` under the local names
 * `tool`, `params-sides`, `params-points`, `params-ratio`. On import, a
 * missing or unknown `wd:tool` falls back to `tool: 'rect'` when the
 * path-then-rect detector fired, else `tool: 'imported'`.
 */

import type { Fill, TextStyle } from '@weasel-js/core';
import {
  svgImageFromKit,
  svgLeafFromKit,
  svgNodesFromKit,
  svgPaintFromKit,
  svgNodesToKitDrafts,
  svgStrokeFromKit,
} from '@weasel-js/svg';
import type {
  ParseResult,
  SerializeOptions,
  SvgKitLeafData,
  SvgKitTree,
  SvgLeafNode,
  SvgNode,
  SvgPathNode,
  SvgTextNode,
} from '@weasel-js/svg';
import { downloadBlob, pickFile } from './fileIO';
import { isPaperSize, type PaperSizeKey } from './paperSizes';
import type { ImageObj, Obj, PathObj, PathParams, PathToolKind, TextObj } from './svgObj';

/**
 * The `wd:` XML namespace, used to ride WeaselDraw-specific metadata
 * (paper-size, group-id, line-height, future: layers, parametric origin)
 * on top of standard SVG. weasel-svg has no knowledge of this URI — it
 * only knows the prefix → URI mapping we pass it via parse / serialize
 * options. All semantics live in this file.
 *
 * The URI does not need to resolve; it's a stable identifier only.
 */
export const SWILL_NS = 'https://weaseldraw.app/svg-ext';
export const SWILL_NAMESPACES = { wd: SWILL_NS } as const;

/** The paper-size key round-tripped via `wd:paperSize`. */
export type WeaselDrawPaperSize = PaperSizeKey;

/** WeaselDraw's notion of the on-disk document, distilled to the bits
 *  svgInterop needs to write the root `<svg>` correctly. */
export interface WeaselDrawDoc {
  title: string;
  size: { width: number; height: number };
  paperSize: WeaselDrawPaperSize;
}

/** Output of {@link parsedToDoc}: a partial doc patch the caller layers on
 *  top of state. Fields are undefined when the source SVG didn't declare
 *  them so callers can fall back to their own defaults. */
export interface ParsedDocPatch {
  title?: string;
  size?: { width: number; height: number };
  paperSize?: WeaselDrawPaperSize;
  backgroundColor?: string;
}

/** The page background as the leading node of an export, marked so an import
 *  reads it back as the document's color and not as a shape. */
export function backgroundSvgNode(color: string, width: number, height: number): SvgPathNode {
  return {
    kind: 'path',
    path: { kind: 'rect', x: 0, y: 0, width, height },
    fill: { kind: 'solid', color },
    meta: { wd: { attrs: { role: 'background' } } },
  };
}

function isBackgroundNode(n: SvgNode): n is SvgPathNode {
  return n.kind === 'path' && n.meta?.wd?.attrs?.role === 'background';
}

/**
 * Build {@link SerializeOptions} from a WeaselDraw doc. Encodes the
 * WeaselDraw-specific paper-size enum + `units` under the `wd:`
 * namespace; standard `viewBox` / `width` / `height` / `<title>` come
 * through as plain SVG fields.
 */
export function docToSerializeOptions(doc: WeaselDrawDoc): SerializeOptions {
  return {
    viewBox: { x: 0, y: 0, width: doc.size.width, height: doc.size.height },
    width: doc.size.width,
    height: doc.size.height,
    title: doc.title || undefined,
    namespaces: SWILL_NAMESPACES,
    documentMeta: {
      wd: {
        attrs: {
          paperSize: doc.paperSize,
          units: 'px',
        },
      },
    },
  };
}

/**
 * Interpret a {@link ParseResult} as a partial WeaselDraw doc patch.
 * The paper-size enum is only set when the source declares a value we
 * recognize (a key of `PAPER_SIZES`); other values are dropped so the
 * caller keeps whatever default it had.
 */
export function parsedToDoc(parsed: ParseResult): ParsedDocPatch {
  const out: ParsedDocPatch = {};
  if (parsed.title != null) out.title = parsed.title;
  if (parsed.viewBox) {
    out.size = { width: parsed.viewBox.width, height: parsed.viewBox.height };
  }
  const ps = parsed.documentMeta?.wd?.attrs?.paperSize;
  if (isPaperSize(ps)) out.paperSize = ps;
  const bg = parsed.nodes.find(isBackgroundNode);
  if (bg?.fill.kind === 'solid') out.backgroundColor = bg.fill.color;
  return out;
}

/**
 * Build the `wd:` attribute bag for an Obj: always emits `tool`, and
 * — for polygon/star PathObjs with `params` set — also `params-sides` /
 * `params-points` / `params-ratio`. Returns an empty-keyed object when
 * there is nothing to write; the caller decides whether to attach it.
 */
function encodeWdAttrs(o: Obj): Record<string, string> {
  const attrs: Record<string, string> = { tool: o.tool };
  if (o.tool !== 'text' && o.tool !== 'image' && o.params) {
    if ('sides' in o.params) attrs['params-sides'] = String(o.params.sides);
    if ('points' in o.params) attrs['params-points'] = String(o.params.points);
    if ('ratio' in o.params) attrs['params-ratio'] = String(o.params.ratio);
  }
  return attrs;
}

/** Recognized values of `wd:tool` for PathObjs. */
const PATH_TOOL_VALUES = new Set<string>([
  'rect', 'ellipse', 'polygon', 'star', 'line', 'pen', 'pencil', 'imported',
]);

/**
 * Resolve the import-side `tool` (and optional `params`) for a `<path>`
 * being lifted back into an Obj. Falls back per the migration rule: if
 * no recognized `wd:tool` is present, infer `tool: 'rect'` when the
 * rect-detector fired (`pathKind === 'rect'`), else `tool: 'imported'`.
 */
function decodePathToolAndParams(
  attrs: Record<string, string> | undefined,
  pathKind: 'rect' | 'polygon',
): { tool: PathToolKind; params?: PathParams } {
  const raw = attrs?.['tool'];
  const tool: PathToolKind =
    raw && PATH_TOOL_VALUES.has(raw)
      ? (raw as PathToolKind)
      : (pathKind === 'rect' ? 'rect' : 'imported');
  let params: PathParams | undefined;
  if (tool === 'polygon' && attrs) {
    const sides = parseFloat(attrs['params-sides']);
    if (Number.isFinite(sides) && sides >= 3) params = { sides };
  } else if (tool === 'star' && attrs) {
    const points = parseFloat(attrs['params-points']);
    const ratio = parseFloat(attrs['params-ratio']);
    if (Number.isFinite(points) && points >= 3 && Number.isFinite(ratio)) {
      params = { points, ratio };
    }
  }
  return { tool, params };
}

/** Lower one WeaselDraw object to an SvgNode for serialization. */
export function objToSvgNode(o: Obj): SvgNode {
  if (o.tool === 'text') {
    // weasel-svg does not model `lineHeight` (it has no clean SVG-native
    // attribute), so it rides in the namespaced meta bag as `wd:line-height`.
    const { lineHeight, ...style } = o.style ?? {};
    const node = svgLeafFromKit({
      text: o.text,
      ...(Object.keys(style).length > 0 ? { style: style as TextStyle } : {}),
      ...(o.runs && o.runs.length > 0 ? { runs: o.runs } : {}),
      ...(o.verticalAlign ? { verticalAlign: o.verticalAlign } : {}),
      ...(o.fill !== undefined ? { fill: o.fill } : {}),
      ...(o.stroke ? { stroke: o.stroke } : {}),
    }, o) as SvgTextNode;
    const wdAttrs = encodeWdAttrs(o);
    if (lineHeight != null) wdAttrs['line-height'] = String(lineHeight);
    node.meta = { wd: { attrs: wdAttrs } };
    return node;
  }
  if (o.tool === 'image') {
    const node = svgImageFromKit(o.image, o);
    node.meta = { wd: { attrs: encodeWdAttrs(o) } };
    return node;
  }
  // Every other Obj is a PathObj — its `path` field is either a RectPath
  // (rect tool) or a PolygonPath (every other tool, including imported).
  const node: SvgPathNode = {
    kind: 'path',
    path: o.path,
    fill: svgPaintFromKit(o.fill?.paint ?? null, o),
  };
  const stroke = svgStrokeFromKit(o.stroke, o);
  if (stroke) node.stroke = stroke;
  node.meta = { wd: { attrs: encodeWdAttrs(o) } };
  if (o.rotation) node.rotation = o.rotation;
  return node;
}

/** Plain AABB the import attaches to a container draft (and `objToSvgNode`
 *  poses already carry). Matches WeaselDraw's `WeaselDrawPose` minus the
 *  optional `rotation` — containers never rotate. */
export interface RectBounds { x: number; y: number; width: number; height: number }

/**
 * One node the importer wants the scene to materialize. The list is
 * ordered parent-before-child so the caller can `scene.add` each draft in
 * turn, resolving `parentId` against the ids it has already inserted.
 *
 *   - `leaf`    — an `Obj` (path/text/image); the caller lowers it to the scene's
 *                 `{pose, data}` shape exactly as it does for root leaves.
 *   - `container` — an SVG `<g>`. Carries the union-AABB of its leaf
 *                 descendants as `pose` so resize handles land sensibly,
 *                 mirroring the kit `group` action's container pose. A
 *                 clipped `<g>` carries its clip in `data`, for the caller
 *                 to add the container with, and the clip's box as `pose`.
 *
 * `id` is the draft's stable identity (from `wd:group-id` for containers,
 * or the leaf `Obj.id`); the caller maps it to the minted `NodeId`.
 */
export type SceneDraft =
  | { kind: 'leaf'; id: string; parentId: string | null; obj: Obj }
  | { kind: 'container'; id: string; parentId: string | null; pose: RectBounds; data: SvgKitLeafData };

/**
 * Lift the kit's lowering of one leaf into an `Obj`, adding what the `wd:`
 * namespace carries: a path's `tool` and `params`, a text's `lineHeight`.
 */
function kitLeafToObj(
  id: string,
  { pose, data }: { pose: RectBounds & { rotation?: number }; data: SvgKitLeafData },
  source: SvgLeafNode,
): Obj | null {
  const attrs = source.meta?.wd?.attrs;
  const box = { x: pose.x, y: pose.y, width: pose.width, height: pose.height };
  if (data.image) {
    const o: ImageObj = { id, tool: 'image', ...box, image: { ...data.image } };
    if (pose.rotation) o.rotation = pose.rotation;
    return o;
  }
  if (data.text != null) {
    const o: TextObj = { id, tool: 'text', ...box, text: data.text };
    if (data.runs && data.runs.length > 0) o.runs = [...data.runs];
    if (data.fill !== undefined) o.fill = data.fill;
    if (data.stroke) o.stroke = data.stroke;
    if (data.verticalAlign) o.verticalAlign = data.verticalAlign;
    if (pose.rotation) o.rotation = pose.rotation;
    const lh = attrs?.['line-height'] != null ? parseFloat(attrs['line-height']) : NaN;
    if (data.style || Number.isFinite(lh)) {
      o.style = { ...(data.style ?? {}) };
      if (Number.isFinite(lh)) o.style.lineHeight = lh;
    }
    return o;
  }
  if (!data.path) return null;
  const { tool, params } = decodePathToolAndParams(attrs, data.path.kind);
  const o: PathObj = {
    id,
    tool,
    ...box,
    path: data.path,
    fill: data.fill === undefined ? DEFAULT_IMPORT_FILL : data.fill,
    stroke: data.stroke ?? null,
    ...(params ? { params } : {}),
  };
  if (pose.rotation) o.rotation = pose.rotation;
  return o;
}

/**
 * Lower a parsed SVG to a flat, parent-before-child list of
 * {@link SceneDraft}s the caller can replay into the scene graph — the kit's
 * `svgNodesToKitDrafts`, with each leaf lifted into an `Obj` and each `<g>`
 * keeping its `wd:group-id` as its container id so round-trips are stable.
 *
 * Handed the whole `ParseResult`, it registers the document's markers too.
 */
export function svgNodesToSceneDrafts(
  input: ParseResult | readonly SvgNode[],
  nextId: () => string,
): SceneDraft[] {
  const nodes = ('nodes' in input ? input.nodes : input).filter((n) => !isBackgroundNode(n));
  const drafts = svgNodesToKitDrafts(
    'nodes' in input ? { ...input, nodes } : nodes,
    (n) => (n.kind === 'group' ? n.meta?.wd?.attrs?.['group-id'] : undefined) ?? nextId(),
    { leaf: kitLeafToObj },
  );
  return drafts.map((d): SceneDraft => (d.kind === 'container'
    ? { kind: 'container', id: d.id, parentId: d.parentId, pose: d.pose, data: d.data }
    : { kind: 'leaf', id: d.id, parentId: d.parentId, obj: d.data }));
}

/**
 * The scene the exporter walks: the kit tree `svgNodesFromKit` reads, plus
 * how this app lowers a leaf.
 *
 *   - `objOf(id)` — the leaf's `Obj`, or `undefined` to skip (e.g. a leaf
 *     with no drawable data).
 *   - `isPainted(id)` — false for a node on a hidden layer, which is skipped
 *     along with everything under it. Omit it and everything is emitted.
 */
export interface SceneSource extends SvgKitTree<string> {
  objOf(id: string): Obj | undefined;
  isPainted?(id: string): boolean;
}

/**
 * Walk a scene's container tree and emit an `SvgNode[]`. Every container
 * becomes an `SvgGroupNode` stamped with `meta.wd.attrs['group-id']` = its
 * scene id, so the structure round-trips back through
 * {@link svgNodesToSceneDrafts}. Every leaf becomes the result of
 * {@link objToSvgNode}.
 *
 * `roots`, when supplied, walks exactly those ids (in the given order)
 * instead of `source.roots` — used for a selection-subset export (see
 * `selectionToSvgString` in `svgExport.ts`). A hidden node is skipped either
 * way: a selection naming one still must not export it.
 */
export function sceneToSvgNodes(source: SceneSource, roots?: readonly string[]): SvgNode[] {
  return svgNodesFromKit(source, {
    ...(roots ? { roots } : {}),
    ...(source.isPainted ? { include: (id: string) => source.isPainted!(id) } : {}),
    leaf: (id) => {
      const obj = source.objOf(id);
      return obj ? objToSvgNode(obj) : null;
    },
    group: (id, g) => ({ ...g, meta: { wd: { attrs: { 'group-id': id } } } }),
  });
}

/** SVG's initial `fill`, for a path that names none. */
const DEFAULT_IMPORT_FILL: Fill = { paint: { color: '#000000' } };

/** Trigger a browser download of `svg` as a file named `filename`. */
export function downloadSvg(svg: string, filename: string): void {
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), filename);
}

/** Pick an SVG file; resolve with its name and text, or null if the user cancelled. */
export async function pickSvgFileNamed(): Promise<{ name: string; text: string } | null> {
  const file = await pickFile('.svg,image/svg+xml');
  if (!file) return null;
  try {
    return { name: file.name, text: await file.text() };
  } catch {
    return null;
  }
}
