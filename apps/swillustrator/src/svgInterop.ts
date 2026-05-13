/**
 * Bridge between Swillustrator's `Obj` discriminated union and
 * `@orochi235/weasel-svg`'s `SvgNode` discriminated union. Each direction
 * is intentionally lossy at the edges (RectObj's stroke/strokeWidth
 * compresses to an SvgStroke; SvgGroupNode flattens on import) — see
 * comments inline for the specifics.
 */

import type { Path, PolygonPath, TextStyle } from '@orochi235/weasel';
import type {
  ParseResult,
  SerializeOptions,
  SvgNode,
  SvgGroupNode,
  SvgPathNode,
  SvgTextNode,
} from '@orochi235/weasel-svg';

interface Group { id: string; members: string[] }

/**
 * The `swill:` XML namespace, used to ride Swillustrator-specific metadata
 * (paper-size, group-id, line-height, future: layers, parametric origin)
 * on top of standard SVG. weasel-svg has no knowledge of this URI — it
 * only knows the prefix → URI mapping we pass it via parse / serialize
 * options. All semantics live in this file.
 *
 * The URI does not need to resolve; it's a stable identifier only.
 */
export const SWILL_NS = 'https://swillustrator.app/svg-ext';
export const SWILL_NAMESPACES = { swill: SWILL_NS } as const;

/** Paper-size enum keys we round-trip via `swill:paperSize`. Must match the
 *  keys of Swillustrator's `PAPER_PRESETS`. */
export type SwillPaperSize = 'letter' | 'a4' | 'legal';

/** Swillustrator's notion of the on-disk document, distilled to the bits
 *  svgInterop needs to write the root `<svg>` correctly. */
export interface SwillDoc {
  title: string;
  size: { width: number; height: number };
  paperSize: SwillPaperSize;
}

/** Output of {@link parsedToDoc}: a partial doc patch the caller layers on
 *  top of state. Fields are undefined when the source SVG didn't declare
 *  them so callers can fall back to their own defaults. */
export interface ParsedDocPatch {
  title?: string;
  size?: { width: number; height: number };
  paperSize?: SwillPaperSize;
}

/**
 * Build {@link SerializeOptions} from a Swillustrator doc. Encodes the
 * Swillustrator-specific paper-size enum + `units` under the `swill:`
 * namespace; standard `viewBox` / `width` / `height` / `<title>` come
 * through as plain SVG fields.
 */
export function docToSerializeOptions(doc: SwillDoc): SerializeOptions {
  return {
    viewBox: { x: 0, y: 0, width: doc.size.width, height: doc.size.height },
    width: doc.size.width,
    height: doc.size.height,
    title: doc.title || undefined,
    namespaces: SWILL_NAMESPACES,
    documentMeta: {
      swill: {
        attrs: {
          paperSize: doc.paperSize,
          units: 'px',
        },
      },
    },
  };
}

/**
 * Interpret a {@link ParseResult} as a partial Swillustrator doc patch.
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
  const ps = parsed.documentMeta?.swill?.attrs?.paperSize;
  if (ps === 'letter' || ps === 'a4' || ps === 'legal') out.paperSize = ps;
  return out;
}

interface BaseObj { id: string; kind: 'rect' | 'text' | 'path'; x: number; y: number; width: number; height: number }
interface RectObj extends BaseObj { kind: 'rect'; fill: string; stroke: string; strokeWidth: number }
interface TextObj extends BaseObj { kind: 'text'; text: string; style?: TextStyle }
interface PathObj extends BaseObj { kind: 'path'; path: PolygonPath; closed: boolean; fill: string; stroke: string; strokeWidth: number }
type Obj = RectObj | TextObj | PathObj;

/** Lower one Swillustrator object to an SvgNode for serialization. */
export function objToSvgNode(o: Obj): SvgNode {
  if (o.kind === 'text') {
    const node: SvgTextNode = {
      kind: 'text',
      x: o.x,
      y: o.y,
      width: o.width,
      height: o.height,
      text: o.text,
    };
    if (o.style) node.style = o.style;
    return node;
  }
  if (o.kind === 'rect') {
    const path: Path = { kind: 'rect', x: o.x, y: o.y, width: o.width, height: o.height };
    const node: SvgPathNode = {
      kind: 'path',
      path,
      fill: { kind: 'solid', color: o.fill },
    };
    if (o.strokeWidth > 0) {
      node.stroke = { paint: { kind: 'solid', color: o.stroke }, width: o.strokeWidth };
    }
    return node;
  }
  // path
  const node: SvgPathNode = {
    kind: 'path',
    path: o.path,
    fill: o.closed ? { kind: 'solid', color: o.fill } : { kind: 'none' },
  };
  if (o.strokeWidth > 0) {
    node.stroke = { paint: { kind: 'solid', color: o.stroke }, width: o.strokeWidth };
  }
  return node;
}

/**
 * Lower a Swillustrator scene (items + groups) to an SvgNode[] tree.
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
  // parent. If two groups claim the same id, fail loudly — Swillustrator's
  // model layer must guarantee this invariant, and a violation here means
  // a bug in group ops, not an encoding ambiguity to silently disambiguate.
  const parentOf = new Map<string, string>();
  for (const g of groups) {
    for (const m of g.members) {
      const existing = parentOf.get(m);
      if (existing) {
        throw new Error(
          `multi-group membership detected: '${m}' belongs to both '${existing}' and '${g.id}'. ` +
          `Swillustrator's group model forbids multi-membership.`,
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
    node.meta = { swill: { attrs: { 'group-id': g.id } } };
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
 * Walk an SvgNode tree and emit a Swillustrator scene (items + groups).
 * Each SvgGroupNode becomes a Group record. The group id is taken from
 * `n.meta?.swill?.attrs?.['group-id']` when set, else synthesized via
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
      const gid = n.meta?.swill?.attrs?.['group-id'] ?? nextId();
      const memberIds: string[] = [];
      for (const c of n.children) memberIds.push(visit(c));
      groups.push({ id: gid, members: memberIds });
      return gid;
    }
    if (n.kind === 'text') {
      const o: TextObj = {
        id: nextId(),
        kind: 'text',
        x: n.x, y: n.y, width: n.width, height: n.height,
        text: n.text,
      };
      if (n.style) o.style = n.style;
      items.push(o);
      return o.id;
    }
    const fill = colorFromPaint(n.fill, '#000000');
    const stroke = n.stroke ? colorFromPaint(n.stroke.paint, '#000000') : '#000000';
    const strokeWidth = n.stroke?.width ?? 0;
    if (n.path.kind === 'rect') {
      const o: RectObj = {
        id: nextId(),
        kind: 'rect',
        x: n.path.x, y: n.path.y, width: n.path.width, height: n.path.height,
        fill, stroke, strokeWidth,
      };
      items.push(o);
      return o.id;
    }
    const path = n.path as PolygonPath;
    const bounds = pathBounds(path);
    const closed = isClosedPolygon(path);
    const o: PathObj = {
      id: nextId(),
      kind: 'path',
      x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
      path, closed, fill, stroke, strokeWidth,
    };
    items.push(o);
    return o.id;
  };
  nodes.forEach(visit);
  return { items, groups };
}

/**
 * Walk an SvgNode tree and emit a flat list of Swillustrator objects.
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
  // Gradients can't be represented as Swillustrator's flat fill string yet —
  // drop to fallback. Caller's UI shows a solid color; the gradient is lost.
  return fallback;
}

function pathBounds(path: PolygonPath): { x: number; y: number; width: number; height: number } {
  const coords = path.coords;
  if (coords.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < coords.length; i += 2) {
    const x = coords[i];
    const y = coords[i + 1];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
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
