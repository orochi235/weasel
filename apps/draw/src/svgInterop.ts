/**
 * Bridge between WeaselDraw's `Obj` discriminated union (`PathObj |
 * TextObj`, discriminated by `tool`) and `@weasel-js/svg`'s
 * `SvgNode` discriminated union. Each direction is intentionally lossy
 * at the edges (PathObj's stroke/strokeWidth compresses to an SvgStroke;
 * SvgGroupNode flattens on import) — see comments inline for the
 * specifics.
 *
 * `tool` and `params` ride on `meta.wd.attrs` under the local names
 * `tool`, `params-sides`, `params-points`, `params-ratio`. On import, a
 * missing or unknown `wd:tool` falls back to `tool: 'rect'` when the
 * path-then-rect detector fired, else `tool: 'imported'`.
 */

import { boundsOfPath } from '@weasel-js/core';
import type { PolygonPath, TextStyle } from '@weasel-js/core';
import type {
  ParseResult,
  SerializeOptions,
  SvgNode,
  SvgGroupNode,
  SvgPathNode,
  SvgTextNode,
} from '@weasel-js/svg';
import type { Obj, PathObj, PathParams, TextObj, ToolKind } from './poseUpdate';

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
  if (o.tool !== 'text' && o.params) {
    if ('sides' in o.params) attrs['params-sides'] = String(o.params.sides);
    if ('points' in o.params) attrs['params-points'] = String(o.params.points);
    if ('ratio' in o.params) attrs['params-ratio'] = String(o.params.ratio);
  }
  return attrs;
}

/** Recognized values of `wd:tool` for PathObjs (everything except `'text'`). */
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
): { tool: Exclude<ToolKind, 'text'>; params?: PathParams } {
  const raw = attrs?.['tool'];
  const tool: Exclude<ToolKind, 'text'> =
    raw && PATH_TOOL_VALUES.has(raw)
      ? (raw as Exclude<ToolKind, 'text'>)
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
    const node: SvgTextNode = {
      kind: 'text',
      x: o.x,
      y: o.y,
      width: o.width,
      height: o.height,
      text: o.text,
    };
    // Start the WeaselDraw attr bag with `tool: 'text'`; lineHeight (if any)
    // joins the same bag.
    const wdAttrs: Record<string, string> = encodeWdAttrs(o);
    if (o.style) {
      // weasel-svg does not model `lineHeight` (it has no clean SVG-native
      // attribute). Lift it into the namespaced meta bag as
      // `wd:line-height="<n>"` so it round-trips losslessly; pass the
      // remaining style fields through verbatim.
      const { lineHeight, ...rest } = o.style;
      if (Object.keys(rest).length > 0) node.style = rest as TextStyle;
      if (lineHeight != null) wdAttrs['line-height'] = String(lineHeight);
    }
    node.meta = { wd: { attrs: wdAttrs } };
    if (o.rotation) node.rotation = o.rotation;
    return node;
  }
  // Every non-text Obj is a PathObj — its `path` field is either a RectPath
  // (rect tool) or a PolygonPath (every other tool, including imported).
  const node: SvgPathNode = {
    kind: 'path',
    path: o.path,
    fill: o.closed ? { kind: 'solid', color: o.fill } : { kind: 'none' },
  };
  if (o.strokeWidth > 0) {
    node.stroke = { paint: { kind: 'solid', color: o.stroke }, width: o.strokeWidth };
  }
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
 *   - `leaf`    — an `Obj` (path/text); the caller lowers it to the scene's
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
 * Lower one path/text `SvgNode` to its `Obj`. Group nodes are not handled
 * here (they have no `Obj` representation) — see {@link svgNodesToSceneDrafts}.
 */
function svgLeafToObj(
  n: SvgPathNode | SvgTextNode,
  id: string,
): Obj {
  if (n.kind === 'text') {
    const o: TextObj = {
      id,
      tool: 'text',
      x: n.x, y: n.y, width: n.width, height: n.height,
      text: n.text,
    };
    if (n.rotation) o.rotation = n.rotation;
    // Reconstitute the full TextStyle from weasel-svg's style + the
    // namespaced lineHeight from the meta bag. weasel-svg doesn't model
    // `lineHeight` so it rides on `meta.wd.attrs['line-height']`.
    const lhStr = n.meta?.wd?.attrs?.['line-height'];
    const lh = lhStr != null ? parseFloat(lhStr) : undefined;
    if (n.style || (lh != null && Number.isFinite(lh))) {
      o.style = { ...(n.style ?? {}) };
      if (lh != null && Number.isFinite(lh)) o.style.lineHeight = lh;
    }
    return o;
  }
  const fill = colorFromPaint(n.fill, '#000000');
  const stroke = n.stroke ? colorFromPaint(n.stroke.paint, '#000000') : '#000000';
  const strokeWidth = n.stroke?.width ?? 0;
  const { tool, params } = decodePathToolAndParams(n.meta?.wd?.attrs, n.path.kind);
  let bounds: RectBounds;
  let closed: boolean;
  if (n.path.kind === 'rect') {
    bounds = { x: n.path.x, y: n.path.y, width: n.path.width, height: n.path.height };
    closed = true;
  } else {
    const b = boundsOfPath(n.path);
    bounds = { x: b.x, y: b.y, width: b.width, height: b.height };
    closed = isClosedPolygon(n.path);
  }
  const o: PathObj = {
    id,
    tool,
    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    path: n.path, closed, fill, stroke, strokeWidth,
    ...(params ? { params } : {}),
  };
  if (n.rotation) o.rotation = n.rotation;
  return o;
}

/**
 * Walk an `SvgNode[]` tree and emit a flat, parent-before-child list of
 * {@link SceneDraft}s the caller can replay into the scene graph.
 *
 * Each SVG `<g>` becomes a `kind:'container'` draft; its children are
 * reparented under it (nested `<g>` → nested containers). The container id
 * is taken from `meta.wd.attrs['group-id']` when present (so round-trips
 * are stable), else synthesized via `nextId()`. Leaf path/text nodes
 * become `kind:'leaf'` drafts carrying their `Obj` and a `parentId`.
 *
 * Container poses are the union-AABB of their leaf descendants — the same
 * "container pose = members' bounds" convention the kit `group` action
 * uses. Empty containers fall back to a zero-size box.
 */
export function svgNodesToSceneDrafts(
  nodes: readonly SvgNode[],
  nextId: () => string,
): SceneDraft[] {
  const drafts: SceneDraft[] = [];

  // Visit a node, appending its draft(s). Returns the union-AABB of the
  // leaves under `n` (a single leaf's own bounds, or a container's
  // descendants' union) so a parent container can compose its own pose.
  const visit = (n: SvgNode, parentId: string | null): RectBounds | null => {
    if (n.kind === 'group') {
      const gid = n.meta?.wd?.attrs?.['group-id'] ?? nextId();
      // Emit the container draft first (parent-before-child) with a
      // placeholder pose; patch it once the descendants' bounds are known.
      const draft: Extract<SceneDraft, { kind: 'container' }> = {
        kind: 'container', id: gid, parentId, pose: { x: 0, y: 0, width: 0, height: 0 },
      };
      drafts.push(draft);
      let acc: RectBounds | null = null;
      for (const c of n.children) {
        const b = visit(c, gid);
        if (b) acc = acc ? unionRect(acc, b) : b;
      }
      if (acc) draft.pose = acc;
      return acc;
    }
    const obj = svgLeafToObj(n, nextId());
    drafts.push({ kind: 'leaf', id: obj.id, parentId, obj });
    return { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
  };

  for (const n of nodes) visit(n, null);
  return drafts;
}

/** Union of two AABBs. */
function unionRect(a: RectBounds, b: RectBounds): RectBounds {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Read-only view of the scene the exporter walks. Decouples
 * {@link sceneToSvgNodes} from the kit `Scene` type so it can be unit-tested
 * with a plain object and reused against any tree shape.
 *
 *   - `roots` — top-level node ids in z-order.
 *   - `childrenOf(id)` — a container's child ids in z-order (empty for leaves).
 *   - `kindOf(id)` — `'container'` for `<g>`-bound nodes, else `'leaf'`.
 *   - `objOf(id)` — the leaf's `Obj`, or `undefined` to skip (e.g. a leaf
 *     with no drawable data).
 */
export interface SceneSource {
  roots: readonly string[];
  childrenOf(id: string): readonly string[];
  kindOf(id: string): 'leaf' | 'container';
  objOf(id: string): Obj | undefined;
}

/**
 * Walk a scene's container tree and emit an `SvgNode[]`. Every container
 * becomes an `SvgGroupNode` (recursing into its children) stamped with
 * `meta.wd.attrs['group-id']` = its scene id, so the structure round-trips
 * back through {@link svgNodesToSceneDrafts}. Every leaf becomes the result
 * of {@link objToSvgNode}.
 *
 * `roots`, when supplied, walks exactly those ids (in the given order)
 * instead of `source.roots` — used for a selection-subset export (see
 * `selectionToSvgString` in `svgExport.ts`). Omitting it is byte-identical
 * to the whole-scene walk.
 */
export function sceneToSvgNodes(source: SceneSource, roots?: readonly string[]): SvgNode[] {
  const emit = (id: string): SvgNode | null => {
    if (source.kindOf(id) === 'container') {
      const children: SvgNode[] = [];
      for (const childId of source.childrenOf(id)) {
        const child = emit(childId);
        if (child) children.push(child);
      }
      const node: SvgGroupNode = { kind: 'group', children };
      node.meta = { wd: { attrs: { 'group-id': id } } };
      return node;
    }
    const obj = source.objOf(id);
    return obj ? objToSvgNode(obj) : null;
  };
  const out: SvgNode[] = [];
  for (const id of roots ?? source.roots) {
    const n = emit(id);
    if (n) out.push(n);
  }
  return out;
}

function colorFromPaint(
  paint: SvgPathNode['fill'] | { kind: 'gradient'; paint: unknown },
  fallback: string,
): string {
  if (paint.kind === 'none') return fallback;
  if (paint.kind === 'solid') return paint.color;
  // Gradients can't be represented as WeaselDraw's flat fill string yet —
  // drop to fallback. Caller's UI shows a solid color; the gradient is lost.
  return fallback;
}

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
