/**
 * Off-page markers on a live scene: an edit pass that splits a connector
 * whose ends land on different pages, joins one whose ends share a page
 * again, and keeps each split connector's two tags, all in the entry of the
 * edit that caused it.
 */
import {
  createDeleteOp,
  createInsertOp,
  createSetDataOp,
  createTransformOp,
  followerHome,
  pageOfNode,
  placedPagesOf,
  type NodeId,
  type Op,
  type PlacedPage,
  type Scene,
  type SceneEditSummary,
} from '@weasel-js/core';
import { diagramEdgeOf, type DiagramEdge } from '../edgeTrait';
import { DIAGRAM_PASS_ORDER } from '../passOrder';
import { diagramThemeOf } from '../theme/resolve';
import type { DiagramTheme } from '../theme/types';
import { offPageSplits, type OffPageEdgeInput } from './split';
import { offPageFarText, offPageTagData, offPageTagLook, offPageTagSize, offPageTagSpec, type OffPageTagLook } from './tag';
import { offPageTagId, type OffPageSplit } from './trait';

/** Options for {@link installOffPageMarkers} and `useOffPageMarkers`. */
export interface OffPageMarkerOptions {
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
 *  ends it moved, added, or re-parented, themselves or by an ancestor, those
 *  whose tag it removed, and every split one, whose tags name pages that a
 *  page edit may have renamed or renumbered. */
function reached(scene: AnyScene, s: SceneEditSummary): Set<string> {
  const ids = new Set<string>([...s.added, ...s.posed, ...s.reparented, ...s.dataChanged]);
  const out = new Set<string>();
  for (const id of s.removed) {
    const tagged = /^(.*)\/offpage-(?:from|to)$/.exec(id);
    if (tagged !== null) out.add(tagged[1]!);
  }
  const touched = (id: string): boolean => {
    for (let at: string | null | undefined = id; at != null; at = scene.get(at as never)?.parent) if (ids.has(at)) return true;
    return false;
  };
  for (const node of scene.renderOrderNodes()) {
    const trait = diagramEdgeOf(node);
    if (trait === null) continue;
    const deps = node.dependsOn;
    if (trait.offPage !== undefined || ids.has(node.id) || (Array.isArray(deps) && deps.some(touched))) out.add(node.id);
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
    const text = offPageFarText(pages, split, end);
    if (tag === undefined) {
      const spec = offPageTagSpec(edge.id, end, text, { ...lookOf(), layer: edge.layer });
      ops.push(createInsertOp({ node: { ...spec, parent: followerHome(scene, spec) } as never, label: 'Off-page' }));
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
  opts: OffPageMarkerOptions = {},
): Op[] {
  const sc = scene as unknown as AnyScene;
  const look = opts.look ?? (() => offPageTagLook(diagramThemeOf(sc, opts.theme)));
  const wanted = edges === 'all' ? null : new Set(edges);
  const pages = placedPagesOf(sc);
  const pageOf = (id: string | undefined): string | null | undefined =>
    (id === undefined || sc.get(id as never) === undefined ? undefined : pageOfNode(sc, id as NodeId));
  const inputs: (OffPageEdgeInput & { node: SceneNode; trait: DiagramEdge })[] = [];
  const used: string[] = [];
  for (const node of sc.renderOrderNodes()) {
    const trait = diagramEdgeOf(node);
    if (trait === null) continue;
    if ((wanted !== null && !wanted.has(node.id)) || sc.isLocked(node.id as never)) {
      if (trait.offPage !== undefined) used.push(trait.offPage.ref);
      continue;
    }
    const deps = node.dependsOn;
    const fromPage = Array.isArray(deps) ? pageOf(deps[0]) : undefined;
    const toPage = Array.isArray(deps) ? pageOf(deps[1]) : undefined;
    if (fromPage === undefined || toPage === undefined) continue;
    inputs.push({ id: node.id, fromPage, toPage, offPage: trait.offPage, node, trait });
  }
  if (inputs.length === 0) return [];
  const splits = offPageSplits({ edges: inputs, used });
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
 * Split `scene`'s connectors across pages from now on: every live edit
 * splits or joins the connectors whose ends it moved, and those it added or
 * rewrote, and retags every split connector, since a page edit may have
 * renamed or renumbered the page a tag names, all in that edit's own history
 * entry. Each end's page is its page ancestor. On install nothing is
 * recomputed. Returns the remover. A host without React calls this; a
 * component calls `useOffPageMarkers`.
 */
export function installOffPageMarkers<TPose>(
  scene: Scene<unknown, string, TPose>,
  opts: OffPageMarkerOptions = {},
): () => void {
  const sc = scene as unknown as AnyScene;
  return scene.addEditPass((summary) => {
    const edges = reached(sc, summary);
    if (edges.size === 0) return null;
    const ops = offPageOps(scene, edges, opts);
    return ops.length === 0 ? null : ops;
  }, { order: DIAGRAM_PASS_ORDER.offPage });
}
