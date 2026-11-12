/**
 * Bridge between WeaselDraw's `Obj` union and `@weasel-js/svg`'s `SvgNode`, layered over the
 * package's own `svgNodesFromKit` / `svgNodesToKitDrafts` walks. What it adds is the `wd:`
 * namespace. An `Obj` exists only in transit between a file and the scene; the scene never
 * stores it.
 *
 * `tool` and `params` ride on `meta.wd.attrs` under the local names `tool`, `params-sides`,
 * `params-points`, `params-ratio`, `params-rotation`; a path's corner shapes under `corners`
 * and `corner-anchors` (`svgCorners.ts`); a leaf's scene id under `leaf-id`, a node's Layers-panel name under
 * `label` and its lock as `locked="true"`, a live path
 * effect on its group (`svgEffects.ts`), `role="mark"` on the group a mark with children
 * exports as, and `role="page"` with `page-id` on the clipped group a page's content saves in.
 */

import type { BooleanShapeOp, Fill, NodeClip, Page, PlacedPage, TextStyle } from '@weasel-js/core';
import { pagesBounds, resolveFill, resolveStroke, withAlpha01 } from '@weasel-js/core';
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
  SvgGroupNode,
  SvgPathNode,
  SvgTextNode,
} from '@weasel-js/svg';
import { downloadBlob } from '@weasel-js/editor';
import { onePage, paperSizeOf } from './pages/drawPages';
import { isPaperSize, PAPER_PRESETS } from './paperSizes';
import { pageElements, pagesOfParsed } from './svgPages';
import type { ImageObj, Obj, PathObj, PathParams, PathToolKind, TextObj } from './svgObj';
import { cornerAttrs, pathWithCorners } from './svgCorners';
import { decodeEffectAttrs, encodeEffectAttrs, type EffectAttrs, type EffectObj } from './svgEffects';
import { decodeNoteAttrs, encodeNoteAttrs, textFrameFields } from './svgNote';

/**
 * The `wd:` XML namespace, carrying WeaselDraw-specific metadata on top of standard SVG.
 * weasel-svg only knows the prefix → URI mapping we pass it via parse / serialize options.
 * The URI does not need to resolve.
 */
export const SWILL_NS = 'https://weaseldraw.app/svg-ext';
export const SWILL_NAMESPACES = { wd: SWILL_NS } as const;

/** WeaselDraw's notion of the on-disk document, distilled to the bits
 *  svgInterop needs to write the root `<svg>` correctly. */
export interface WeaselDrawDoc {
  title: string;
  /** Every page, placed; the `viewBox` is the box around them. */
  pages: readonly PlacedPage[];
}

/** Output of {@link parsedToDoc}: a partial doc patch the caller layers on
 *  top of state. Fields are undefined when the source SVG didn't declare
 *  them so callers can fall back to their own defaults. */
export interface ParsedDocPatch {
  title?: string;
  size?: { width: number; height: number };
  /** The file's `wd:page` list, else one page of its `wd:paperSize`. */
  pages?: Page[];
  backgroundColor?: string;
}

/** A page's background as a leading node of an export, marked so an import
 *  reads it back as the document's color and not as a shape. */
export function backgroundSvgNode(
  color: string,
  rect: { x: number; y: number; width: number; height: number },
): SvgPathNode {
  return {
    kind: 'path',
    path: { kind: 'rect', x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    fill: { kind: 'solid', color },
    meta: { wd: { attrs: { role: 'background' } } },
  };
}

function isBackgroundNode(n: SvgNode): n is SvgPathNode {
  return n.kind === 'path' && n.meta?.wd?.attrs?.role === 'background';
}

/** {@link SerializeOptions} for a WeaselDraw doc: the page list and `units` go under the `wd:`
 *  namespace, with the first page's paper size as `wd:paperSize` when it is one draw offers, which
 *  is what a reader from before pages takes. */
export function docToSerializeOptions(doc: WeaselDrawDoc): SerializeOptions {
  const box = pagesBounds(doc.pages) ?? { x: 0, y: 0, width: 0, height: 0 };
  const first = doc.pages[0];
  const paperSize = first ? paperSizeOf(first) : null;
  return {
    viewBox: box,
    width: box.width,
    height: box.height,
    title: doc.title || undefined,
    namespaces: SWILL_NAMESPACES,
    documentMeta: {
      wd: {
        attrs: { ...(paperSize ? { paperSize } : {}), units: 'px' },
        elements: { page: pageElements(doc.pages) },
      },
    },
  };
}

/** A {@link ParseResult} as a partial doc patch. `pages` is only set when the source lists its
 *  pages or declares a paper size we recognize. */
export function parsedToDoc(parsed: ParseResult): ParsedDocPatch {
  const out: ParsedDocPatch = {};
  if (parsed.title != null) out.title = parsed.title;
  if (parsed.viewBox) {
    out.size = { width: parsed.viewBox.width, height: parsed.viewBox.height };
  }
  const ps = parsed.documentMeta?.wd?.attrs?.paperSize;
  const pages = pagesOfParsed(parsed) ?? (isPaperSize(ps) ? [...onePage(PAPER_PRESETS[ps]).pages] : undefined);
  if (pages) out.pages = pages;
  const bg = parsed.nodes.find(isBackgroundNode);
  if (bg?.fill.kind === 'solid') {
    const { color, opacity } = bg.fill;
    out.backgroundColor = opacity === undefined || opacity >= 1 ? color : withAlpha01(color, opacity);
  }
  return out;
}

/** The `wd:` attribute bag for an Obj: always `tool` and `leaf-id`, plus `params-sides` / `params-points` /
 *  `params-ratio` / `params-rotation` for polygon/star PathObjs with `params` set. */
function encodeWdAttrs(o: Obj): Record<string, string> {
  const attrs: Record<string, string> = { tool: o.tool, 'leaf-id': o.id };
  if (o.tool !== 'text' && o.tool !== 'image' && o.params) {
    if ('sides' in o.params) attrs['params-sides'] = String(o.params.sides);
    if ('points' in o.params) attrs['params-points'] = String(o.params.points);
    if ('ratio' in o.params) attrs['params-ratio'] = String(o.params.ratio);
    if (o.params.rotation !== undefined) attrs['params-rotation'] = String(o.params.rotation);
  }
  return attrs;
}

/** Recognized values of `wd:tool` for PathObjs. */
const PATH_TOOL_VALUES = new Set<string>([
  'rect', 'ellipse', 'polygon', 'star', 'line', 'pen', 'pencil', 'imported',
]);

/** The import-side `tool` (and optional `params`) for a `<path>`. With no recognized `wd:tool`,
 *  infers `rect` when the rect-detector fired (`pathKind === 'rect'`), else `imported`. */
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
  const rotation = attrs ? parseFloat(attrs['params-rotation']) : NaN;
  const rotated = Number.isFinite(rotation) ? { rotation } : {};
  if (tool === 'polygon' && attrs) {
    const sides = parseFloat(attrs['params-sides']);
    if (Number.isFinite(sides) && sides >= 3) params = { sides, ...rotated };
  } else if (tool === 'star' && attrs) {
    const points = parseFloat(attrs['params-points']);
    const ratio = parseFloat(attrs['params-ratio']);
    if (Number.isFinite(points) && points >= 3 && Number.isFinite(ratio)) {
      params = { points, ratio, ...rotated };
    }
  }
  return { tool, params };
}

/** Lower one WeaselDraw object to an SvgNode for serialization. */
export function objToSvgNode(o: Obj): SvgNode {
  if (o.tool === 'text') {
    const style = o.style ?? {};
    // A note is a group, which carries the attributes for the whole of it.
    const node = svgLeafFromKit({
      text: o.text,
      ...(Object.keys(style).length > 0 ? { style: style as TextStyle } : {}),
      ...(o.runs && o.runs.length > 0 ? { runs: o.runs } : {}),
      ...(o.verticalAlign ? { verticalAlign: o.verticalAlign } : {}),
      fill: o.fill === undefined ? DEFAULT_IMPORT_FILL : o.fill,
      ...(o.stroke ? { stroke: o.stroke } : {}),
      ...textFrameFields(o),
    }, o) as SvgTextNode | SvgGroupNode;
    node.meta = { wd: { attrs: { ...encodeWdAttrs(o), ...encodeNoteAttrs(o) } } };
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
    fill: svgPaintFromKit(resolveFill(o.fill)?.paint ?? null, o),
  };
  const stroke = svgStrokeFromKit(resolveStroke(o.stroke), o);
  if (stroke) node.stroke = stroke;
  node.meta = { wd: { attrs: { ...encodeWdAttrs(o), ...cornerAttrs(o.path) } } };
  if (o.rotation) node.rotation = o.rotation;
  return node;
}

/** Plain AABB the import attaches to a container draft: `WeaselDrawPose` minus `rotation` —
 *  containers never rotate. */
export interface RectBounds { x: number; y: number; width: number; height: number }

/**
 * One node the importer wants the scene to materialize. The list is ordered parent-before-child
 * so the caller can `scene.add` each draft in turn, resolving `parentId` against the ids it has
 * already inserted.
 *
 * A `group` is an SVG `<g>`; its `pose` is the union-AABB of its leaf descendants. A clipped
 * `<g>` declares `clip: 'outline'`, carries its clip in `data` and the clip's box as `pose`.
 *
 * An `effect` is the group a live path effect exported as: it opens as that effect where the file
 * holds its sources too, and as a container of the drafts under it otherwise.
 *
 * `id` comes from `wd:group-id` for containers and `wd:leaf-id` for leaves and effects, where
 * the file carries one; the caller maps it to the minted `NodeId`.
 *
 * A page's group is no draft: each top-level draft under one names that page's id as `page`.
 */
interface DraftBase { id: string; parentId: string | null; clip?: NodeClip; hidden?: true; page?: string; label?: string; locked?: true }
export type SceneDraft =
  | (DraftBase & { kind: 'mark'; obj: Obj; boolean?: BooleanShapeOp })
  | (DraftBase & { kind: 'group'; pose: RectBounds; data: SvgKitLeafData })
  | (DraftBase & { kind: 'effect'; pose: RectBounds; data: SvgKitLeafData } & EffectAttrs);

/**
 * Lift the kit's lowering of one leaf into an `Obj`, adding what the `wd:`
 * namespace carries: a path's `tool` and `params`. A text's `lineHeight` is
 * also read from `wd:line-height`, where files written before weasel-svg
 * stated it put it.
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
    Object.assign(o, textFrameFields(data), decodeNoteAttrs(attrs));
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
    path: pathWithCorners(data.path, attrs),
    fill: data.fill === undefined ? DEFAULT_IMPORT_FILL : data.fill,
    stroke: data.stroke ?? null,
    ...(params ? { params } : {}),
  };
  if (pose.rotation) o.rotation = pose.rotation;
  return o;
}

/**
 * A parsed SVG as a flat, parent-before-child list of {@link SceneDraft}s. Each `<g>` keeps its
 * `wd:group-id` as its container id so round-trips are stable. Handed the whole `ParseResult`,
 * it registers the document's markers too.
 */
export function svgNodesToSceneDrafts(
  input: ParseResult | readonly SvgNode[],
  nextId: () => string,
): SceneDraft[] {
  const nodes = ('nodes' in input ? input.nodes : input).filter((n) => !isBackgroundNode(n));
  const effects = new Map<string, EffectAttrs>();
  const marks = new Map<string, Pick<DraftBase, 'label' | 'locked'>>();
  const pageOfGroup = new Map<string, string>();
  const used = new Set<string>();
  const idOf = (n: SvgNode): string => {
    const attrs = n.meta?.wd?.attrs;
    if (n.kind === 'group' && attrs?.role === PAGE_ROLE && attrs['page-id']) {
      const id = nextId();
      pageOfGroup.set(id, attrs['page-id']);
      return id;
    }
    const carried = n.kind === 'group' ? attrs?.['group-id'] ?? attrs?.['leaf-id'] : attrs?.['leaf-id'];
    const id = carried !== undefined && !used.has(carried) ? carried : nextId();
    used.add(id);
    const named = decodeNodeAttrs(attrs);
    if (named.label !== undefined || named.locked) marks.set(id, named);
    const effect = n.kind === 'group' ? decodeEffectAttrs(attrs) : null;
    if (effect !== null) effects.set(id, effect);
    return id;
  };
  const drafts = svgNodesToKitDrafts('nodes' in input ? { ...input, nodes } : nodes, idOf, {
    leaf: kitLeafToObj,
    // A blend of no steps or a repeat of no copies exports an empty group.
    keepEmpty: (g) => decodeEffectAttrs(g.meta?.wd?.attrs) !== null,
    mark: (g) => g.meta?.wd?.attrs?.role === MARK_ROLE,
  });
  return drafts.flatMap((d): SceneDraft[] => {
    if (pageOfGroup.has(d.id)) return [];
    const page = d.parentId === null ? undefined : pageOfGroup.get(d.parentId);
    const base: DraftBase = {
      id: d.id,
      parentId: page === undefined ? d.parentId : null,
      ...(d.clip ? { clip: d.clip } : {}),
      ...(d.hidden ? { hidden: true as const } : {}),
      ...(page === undefined ? {} : { page }),
      ...marks.get(d.id),
    };
    if (d.kind === 'mark') return [{ kind: 'mark', ...base, obj: d.data, ...(d.boolean ? { boolean: d.boolean } : {}) }];
    const group = { ...base, pose: d.pose, data: d.data };
    const effect = effects.get(d.id);
    return [effect === undefined ? { kind: 'group', ...group } : { kind: 'effect', ...group, ...effect }];
  });
}

/**
 * The scene the exporter walks: the kit tree `svgNodesFromKit` reads, plus how this app lowers a
 * leaf. `objOf` returns `undefined` to skip a leaf. `isPainted` is false for a node on a hidden
 * layer, which is skipped along with everything under it.
 */
export interface SceneSource extends SvgKitTree<string> {
  /** The leaf as one object, or as a live path effect, which exports as a
   *  group of the paths it shows. */
  objOf(id: string): Obj | EffectObj | undefined;
  isPainted?(id: string): boolean;
  /** The page id (`Page.id`) of a page's node; `undefined` for any other node. */
  pageIdOf?(id: string): string | undefined;
  /** The name the Layers panel shows for the node, where it was given one, and whether it is locked. */
  nodeOf?(id: string): { label?: string; locked?: boolean } | undefined;
}

/**
 * A scene's container tree as `SvgNode[]`. Every container becomes a group stamped with
 * `meta.wd.attrs['group-id']` = its scene id, and a mark with children one stamped with
 * `role="mark"`, so the structure round-trips back through {@link svgNodesToSceneDrafts}.
 *
 * `roots`, when supplied, walks exactly those ids (in the given order) instead of
 * `source.roots`. A hidden node is skipped either way: a selection naming one still must not
 * export it.
 */
export function sceneToSvgNodes(source: SceneSource, roots?: readonly string[]): SvgNode[] {
  const named = <T extends SvgNode>(id: string, node: T): T => {
    const attrs = encodeNodeAttrs(source.nodeOf?.(id));
    if (attrs === null) return node;
    return { ...node, meta: { ...node.meta, wd: { ...node.meta?.wd, attrs: { ...node.meta?.wd?.attrs, ...attrs } } } };
  };
  return svgNodesFromKit(source, {
    ...(roots ? { roots } : {}),
    ...(source.isPainted ? { include: (id: string) => source.isPainted!(id) } : {}),
    leaf: (id) => {
      const obj = source.objOf(id);
      if (obj === undefined) return null;
      if (!('effect' in obj)) return named(id, objToSvgNode(obj));
      return named(id, { kind: 'group', children: obj.parts.map(objToSvgNode), meta: { wd: { attrs: encodeEffectAttrs(obj) } } });
    },
    group: (id, g) => {
      const page = source.pageIdOf?.(id);
      if (page !== undefined) return { ...g, meta: { wd: { attrs: { role: PAGE_ROLE, 'page-id': page } } } };
      return named(id, { ...g, meta: { wd: { attrs: { 'group-id': id } } } });
    },
    mark: (_id, g) => ({ ...g, meta: { wd: { attrs: { role: MARK_ROLE } } } }),
  });
}

/** The `wd:` attributes naming and locking a node: `label`, and `locked="true"`; `null` for neither. */
function encodeNodeAttrs(node: { label?: string; locked?: boolean } | undefined): Record<string, string> | null {
  if (node?.label === undefined && node?.locked !== true) return null;
  return { ...(node.label === undefined ? {} : { label: node.label }), ...(node.locked ? { locked: 'true' } : {}) };
}

function decodeNodeAttrs(attrs: Record<string, string> | undefined): Pick<DraftBase, 'label' | 'locked'> {
  return {
    ...(attrs?.label === undefined ? {} : { label: attrs.label }),
    ...(attrs?.locked === 'true' ? { locked: true as const } : {}),
  };
}

/** `wd:role` on the group a mark with children exports as; its first element is the mark. */
const MARK_ROLE = 'mark';

/** `wd:role` on the group a page's content saves in, clipped to the page; `wd:page-id` names the page. */
const PAGE_ROLE = 'page';

/** SVG's initial `fill`, for a path or text that names none. */
const DEFAULT_IMPORT_FILL: Fill = { paint: { color: '#000000' } };

/** Trigger a browser download of `svg` as a file named `filename`. */
export function downloadSvg(svg: string, filename: string): void {
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), filename);
}

