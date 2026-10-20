/**
 * Off-page markers on a live scene: an edit pass that splits a connector
 * whose ends land on different pages, joins one whose ends share a page
 * again, and keeps each split connector's two tags, all in the entry of the
 * edit that caused it.
 */
import {
  AUTO_POSE_DESCRIPTOR,
  PAGES_DOC_KEY,
  createDeleteOp,
  createInsertOp,
  createSetDataOp,
  createTransformOp,
  documentPose,
  pageName,
  placedPagesOf,
  type Op,
  type PlacedPage,
  type PoseDescriptor,
  type Scene,
  type SceneEditSummary,
} from '@weasel-js/core';
import { diagramEdgeOf, type DiagramEdge } from '../edgeTrait';
import { DIAGRAM_PASS_ORDER } from '../passOrder';
import { diagramThemeOf } from '../theme/resolve';
import type { DiagramTheme } from '../theme/types';
import { offPageSplits, type OffPageEdgeInput } from './split';
import { offPageTagData, offPageTagLook, offPageTagSize, offPageTagSpec, offPageTagText, type OffPageTagLook } from './tag';
import { offPageTagId, type OffPageSplit } from './trait';

/** Options for {@link installOffPageMarkers} and `useOffPageMarkers`. */
export interface OffPageMarkerOptions<TPose> {
  /** How node poses are measured. Default `AUTO_POSE_DESCRIPTOR`. */
  geometry?: PoseDescriptor<TPose>;
  /** The look a tag is given as it is made or retexted. Default the scene's
   *  theme (`diagram:theme`), else `theme`. */
  look?: () => OffPageTagLook;
  /** The theme a scene naming none is drawn in. */
  theme?: DiagramTheme;
}

type AnyScene = Scene<unknown, string, unknown>;
type SceneNode = ReturnType<AnyScene['renderOrderNodes']>[number];
const ENDS = ['from', 'to'] as const;

const sameSplit = (a: OffPageSplit | undefined, b: OffPageSplit | null): boolean =>
  (a === undefined ? b === null : b !== null && a.ref === b.ref && a.from === b.from && a.to === b.to);

function withSplit(data: unknown, edge: DiagramEdge, split: OffPageSplit | null): Record<string, unknown> {
  const { offPage: _o, ...rest } = edge;
  return { ...(data as Record<string, unknown>), diagram: split === null ? rest : { ...rest, offPage: split } };
}

/** The connectors an edit's summary reaches: those it added, wrote, or whose
 *  ends it moved, added, or re-parented, and those whose tag it removed. */
function reached(scene: AnyScene, s: SceneEditSummary): Set<string> {
  const ids = new Set<string>([...s.added, ...s.posed, ...s.reparented, ...s.dataChanged]);
  const out = new Set<string>();
  for (const id of s.removed) {
    const tagged = /^(.*)\/offpage-(?:from|to)$/.exec(id);
    if (tagged !== null) out.add(tagged[1]!);
  }
  for (const node of scene.renderOrderNodes()) {
    if (diagramEdgeOf(node) === null) continue;
    const deps = node.dependsOn;
    if (ids.has(node.id) || (Array.isArray(deps) && deps.some((d) => ids.has(d)))) out.add(node.id);
  }
  return out;
}

/** The ops that bring one connector's two tags in line with `split`. */
function tagOps(scene: AnyScene, edge: SceneNode, split: OffPageSplit | null, pages: readonly PlacedPage[], look: () => OffPageTagLook): Op[] {
  const ops: Op[] = [];
  let lookNow: OffPageTagLook | null = null;
  const lookOf = () => (lookNow ??= look());
  for (const end of ENDS) {
    const id = offPageTagId(edge.id, end);
    const tag = scene.get(id as never);
    if (split === null) {
      if (tag !== undefined) ops.push(createDeleteOp({ node: tag as never, label: 'Off-page' }));
      continue;
    }
    const far = end === 'from' ? split.to : split.from;
    const index = pages.findIndex((p) => p.id === far);
    const text = offPageTagText(index < 0 ? far : pageName(pages[index]!, index), split.ref);
    if (tag === undefined) {
      const spec = offPageTagSpec(edge.id, end, text, { ...lookOf(), layer: edge.layer });
      ops.push(createInsertOp({ node: { ...spec, parent: null } as never, label: 'Off-page' }));
    } else if ((tag.data as { text?: unknown }).text !== text) {
      const old = tag.data as { style?: OffPageTagLook['style']; fill?: { paint?: { color?: string } }; background?: { paint?: { color?: string } }; padding?: number };
      // Keeps the tag's own colors and face, which a theme or the author may have set since.
      const kept: OffPageTagLook = {
        ...lookOf(),
        ...(old.style ? { style: old.style } : {}),
        ...(old.fill?.paint?.color ? { fill: old.fill.paint.color } : {}),
        ...(old.background?.paint?.color ? { background: old.background.paint.color } : {}),
        ...(old.padding !== undefined ? { padding: old.padding } : {}),
      };
      ops.push(createSetDataOp({ id, from: tag.data, to: { ...(tag.data as object), ...offPageTagData(edge.id, end, text, kept) }, label: 'Off-page' }));
      const pose = tag.pose as Record<string, unknown>;
      ops.push(createTransformOp({ id, from: tag.pose, to: { ...pose, ...offPageTagSize(text, kept) }, label: 'Off-page' }));
    }
  }
  return ops;
}

/**
 * The ops that split, join, and tag the connectors `edges` names (every one,
 * for `'all'`), so each is split exactly when its ends sit on different
 * pages. Empty when nothing changes. The edit pass runs this; a host can run
 * it once over a document saved before it had off-page markers.
 */
export function offPageOps<TPose>(
  scene: Scene<unknown, string, TPose>,
  edges: Iterable<string> | 'all',
  opts: OffPageMarkerOptions<TPose> = {},
): Op[] {
  const sc = scene as unknown as AnyScene;
  const geometry = (opts.geometry ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<unknown>;
  const look = opts.look ?? (() => offPageTagLook(diagramThemeOf(sc, opts.theme)));
  const wanted = edges === 'all' ? null : new Set(edges);
  const pages = placedPagesOf(sc);
  const boxOf = (id: string) => {
    const node = sc.get(id as never);
    return node === undefined ? null : geometry.getBounds(documentPose(sc, node as never));
  };
  const inputs: (OffPageEdgeInput & { node: SceneNode; trait: DiagramEdge })[] = [];
  const used: string[] = [];
  for (const node of sc.renderOrderNodes()) {
    const trait = diagramEdgeOf(node);
    if (trait === null) continue;
    if (wanted !== null && !wanted.has(node.id)) {
      if (trait.offPage !== undefined) used.push(trait.offPage.ref);
      continue;
    }
    const deps = node.dependsOn;
    const from = Array.isArray(deps) ? boxOf(deps[0]!) : null;
    const to = Array.isArray(deps) ? boxOf(deps[1]!) : null;
    if (from === null || to === null) continue;
    inputs.push({ id: node.id, from, to, offPage: trait.offPage, node, trait });
  }
  if (inputs.length === 0) return [];
  const splits = offPageSplits({ pages, edges: inputs, used });
  const ops: Op[] = [];
  for (const edge of inputs) {
    const split = splits.get(edge.id) ?? null;
    if (!sameSplit(edge.trait.offPage, split)) {
      ops.push(createSetDataOp({ id: edge.id, from: edge.node.data, to: withSplit(edge.node.data, edge.trait, split), label: 'Off-page' }));
    }
    ops.push(...tagOps(sc, edge.node, split, pages, look));
  }
  return ops;
}

/**
 * Split `scene`'s connectors across pages from now on: every live edit that
 * moves a connector's end, adds or rewrites a connector, or changes the pages
 * splits, joins, and retags what it reached, in its own history entry. On
 * install nothing is recomputed. Returns the remover. A host without React
 * calls this; a component calls `useOffPageMarkers`.
 */
export function installOffPageMarkers<TPose>(
  scene: Scene<unknown, string, TPose>,
  opts: OffPageMarkerOptions<TPose> = {},
): () => void {
  const sc = scene as unknown as AnyScene;
  return scene.addEditPass((summary) => {
    const edges = summary.docChanged.has(PAGES_DOC_KEY) ? 'all' : reached(sc, summary);
    if (edges !== 'all' && edges.size === 0) return null;
    const ops = offPageOps(scene, edges, opts);
    return ops.length === 0 ? null : ops;
  }, { order: DIAGRAM_PASS_ORDER.offPage });
}
