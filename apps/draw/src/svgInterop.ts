/**
 * Bridge between WeaselDraw's `Obj` discriminated union (`PathObj |
 * TextObj | ImageObj`, discriminated by `tool`) and `@weasel-js/svg`'s
 * `SvgNode` discriminated union, layered over the package's own
 * `svgNodesFromKit` / `svgNodesToKitDrafts` walks. What it adds is the `wd:`
 * namespace.
 *
 * `tool` and `params` ride on `meta.wd.attrs` under the local names
 * `tool`, `params-sides`, `params-points`, `params-ratio`. On import, a
 * missing or unknown `wd:tool` falls back to `tool: 'rect'` when the
 * path-then-rect detector fired, else `tool: 'imported'`.
 */

import type { FillStyle, PolygonPath, TextStyle } from '@weasel-js/core';
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
import type { ImageObj, Obj, PathObj, PathParams, PathToolKind, TextObj } from './poseUpdate';

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

/** Paper-size enum keys we round-trip via `wd:paperSize`. Must match the
 *  keys of WeaselDraw's `PAPER_PRESETS`. */
export type WeaselDrawPaperSize = 'letter' | 'a4' | 'legal';

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
 * recognize (`letter` | `a4` | `legal`); other values are dropped so the
 * caller keeps whatever default it had.
 */
export function parsedToDoc(parsed: ParseResult): ParsedDocPatch {
  const out: ParsedDocPatch = {};
  if (parsed.title != null) out.title = parsed.title;
  if (parsed.viewBox) {
    out.size = { width: parsed.viewBox.width, height: parsed.viewBox.height };
  }
  const ps = parsed.documentMeta?.wd?.attrs?.paperSize;
  if (ps === 'letter' || ps === 'a4' || ps === 'legal') out.paperSize = ps;
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
    fill: svgPaintFromKit(o.closed ? o.fill : null, o),
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
 *                 mirroring the kit `group` action's container pose.
 *
 * `id` is the draft's stable identity (from `wd:group-id` for containers,
 * or the leaf `Obj.id`); the caller maps it to the minted `NodeId`.
 */
export type SceneDraft =
  | { kind: 'leaf'; id: string; parentId: string | null; obj: Obj }
  | { kind: 'container'; id: string; parentId: string | null; pose: RectBounds };

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
    closed: data.path.kind === 'rect' || isClosedPolygon(data.path),
    fill: data.fill ?? DEFAULT_IMPORT_FILL,
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
  const drafts = svgNodesToKitDrafts(
    input,
    (n) => (n.kind === 'group' ? n.meta?.wd?.attrs?.['group-id'] : undefined) ?? nextId(),
    { leaf: kitLeafToObj },
  );
  return drafts.map((d): SceneDraft => (d.kind === 'container'
    ? { kind: 'container', id: d.id, parentId: d.parentId, pose: d.pose }
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

/** What an imported `fill="none"` path is filled with. WeaselDraw's own
 *  `closed` flag decides whether that fill is painted, so the import keeps a
 *  color for the object to fall back on when it is closed later. */
const DEFAULT_IMPORT_FILL: FillStyle = { color: '#000000' };

function isClosedPolygon(path: PolygonPath): boolean {
  const commands = path.commands;
  if (commands.length === 0) return false;
  const last = commands[commands.length - 1];
  return last === 4 /* PATH_Z */;
}

/** Trigger a browser download of `svg` as a file named `filename`. */
export function downloadSvg(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so the click has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Pop a hidden file input; resolve with the chosen file's text (or null
 * if the user cancelled). Single-shot — the input is created and removed
 * per invocation so there's no accumulated DOM cruft.
 */
export function pickSvgFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.svg,image/svg+xml';
    input.style.display = 'none';
    document.body.appendChild(input);
    let resolved = false;
    const cleanup = (): void => {
      if (input.parentNode) input.parentNode.removeChild(input);
    };
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        if (!resolved) { resolved = true; resolve(null); }
        cleanup();
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (!resolved) { resolved = true; resolve(String(reader.result ?? '')); }
        cleanup();
      };
      reader.onerror = () => {
        if (!resolved) { resolved = true; resolve(null); }
        cleanup();
      };
      reader.readAsText(file);
    });
    // Fallback: if the picker is dismissed without firing change, give up.
    input.addEventListener('cancel', () => {
      if (!resolved) { resolved = true; resolve(null); }
      cleanup();
    });
    input.click();
  });
}
