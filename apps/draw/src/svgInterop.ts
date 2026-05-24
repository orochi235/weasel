/**
 * Bridge between WeaselDraw's `Obj` discriminated union (`PathObj |
 * TextObj`, discriminated by `tool`) and `@orochi235/weasel-svg`'s
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

import { boundsOfPath } from '@orochi235/weasel';
import type { PolygonPath, TextStyle } from '@orochi235/weasel';
import type {
  ParseResult,
  SerializeOptions,
  SvgNode,
  SvgGroupNode,
  SvgPathNode,
  SvgTextNode,
} from '@orochi235/weasel-svg';
import type { Obj, PathObj, PathParams, TextObj, ToolKind } from './poseUpdate';

interface Group { id: string; members: string[] }

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

/**
 * Lower a WeaselDraw scene (items + groups) to an SvgNode[] tree.
 * Items that belong to a group are emitted inside that group's
 * SvgGroupNode; items not in any group sit at the root.
 *
 * Nested groups are supported via Group.members containing group ids.
 * A group id appears in the output tree exactly once (under its parent,
 * or at root if it has no parent group).
 *
 * Single-group-membership invariant: each item / group id appears in at
 * most one parent group's `members[]`. The function throws if the input
 * violates this; the model layer is expected to maintain it.
 */
export function objsToSvgNodes(items: readonly Obj[], groups: readonly Group[]): SvgNode[] {
  const itemsById = new Map<string, Obj>();
  for (const o of items) itemsById.set(o.id, o);
  const groupsById = new Map<string, Group>();
  for (const g of groups) groupsById.set(g.id, g);

  // Enforce single-group-membership: each child id appears in at most one
  // parent. If two groups claim the same id, fail loudly — WeaselDraw's
  // model layer must guarantee this invariant, and a violation here means
  // a bug in group ops, not an encoding ambiguity to silently disambiguate.
  const parentOf = new Map<string, string>();
  for (const g of groups) {
    for (const m of g.members) {
      const existing = parentOf.get(m);
      if (existing) {
        throw new Error(
          `multi-group membership detected: '${m}' belongs to both '${existing}' and '${g.id}'. ` +
          `WeaselDraw's group model forbids multi-membership.`,
        );
      }
      parentOf.set(m, g.id);
    }
  }

  const buildGroup = (g: Group): SvgGroupNode => {
    const children: SvgNode[] = [];
    for (const m of g.members) {
      const childGroup = groupsById.get(m);
      if (childGroup) {
        children.push(buildGroup(childGroup));
        continue;
      }
      const childItem = itemsById.get(m);
      if (childItem) children.push(objToSvgNode(childItem));
    }
    const node: SvgGroupNode = { kind: 'group', children };
    node.meta = { wd: { attrs: { 'group-id': g.id } } };
    return node;
  };

  const out: SvgNode[] = [];
  // Root-level groups: groups that aren't a member of any other group.
  for (const g of groups) {
    if (!parentOf.has(g.id)) out.push(buildGroup(g));
  }
  // Root-level items: items not claimed by any group.
  for (const o of items) {
    if (!parentOf.has(o.id)) out.push(objToSvgNode(o));
  }
  return out;
}

/**
 * Walk an SvgNode tree and emit a WeaselDraw scene (items + groups).
 * Each SvgGroupNode becomes a Group record. The group id is taken from
 * `n.meta?.wd?.attrs?.['group-id']` when set, else synthesized via
 * `nextId()`. Nested groups produce nested Group.members lists.
 */
export function svgNodesToObjsWithGroups(
  nodes: readonly SvgNode[],
  nextId: () => string,
): { items: Obj[]; groups: Group[] } {
  const items: Obj[] = [];
  const groups: Group[] = [];

  const visit = (n: SvgNode): string => {
    if (n.kind === 'group') {
      const gid = n.meta?.wd?.attrs?.['group-id'] ?? nextId();
      const memberIds: string[] = [];
      for (const c of n.children) memberIds.push(visit(c));
      groups.push({ id: gid, members: memberIds });
      return gid;
    }
    if (n.kind === 'text') {
      const o: TextObj = {
        id: nextId(),
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
      items.push(o);
      return o.id;
    }
    const fill = colorFromPaint(n.fill, '#000000');
    const stroke = n.stroke ? colorFromPaint(n.stroke.paint, '#000000') : '#000000';
    const strokeWidth = n.stroke?.width ?? 0;
    const { tool, params } = decodePathToolAndParams(n.meta?.wd?.attrs, n.path.kind);
    let bounds: { x: number; y: number; width: number; height: number };
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
      id: nextId(),
      tool,
      x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
      path: n.path, closed, fill, stroke, strokeWidth,
      ...(params ? { params } : {}),
    };
    if (n.rotation) o.rotation = n.rotation;
    items.push(o);
    return o.id;
  };
  nodes.forEach(visit);
  return { items, groups };
}

/**
 * Walk an SvgNode tree and emit a flat list of WeaselDraw objects.
 * Thin wrapper around {@link svgNodesToObjsWithGroups} that discards the
 * group output — retained for call sites that don't yet consume groups.
 */
export function svgNodesToObjs(
  nodes: readonly SvgNode[],
  nextId: () => string,
): Obj[] {
  return svgNodesToObjsWithGroups(nodes, nextId).items;
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
