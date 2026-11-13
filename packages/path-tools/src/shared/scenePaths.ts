/**
 * What the click-driven path commands share: the press they act at and how
 * far it reaches, the strokes of the scene they act on, and the outlines that
 * stop or cut them.
 */
import type { ActionDeps } from '@weasel-js/routing';
import { type Path, pxReach } from '@weasel-js/geom';
import { type NodeId, nodeOutline, type PathNode, pathNodesOf, type Scene, type SceneNode, shownNodeOf } from '@weasel-js/core';
import type { ImmediateParams } from '@weasel-js/routing';
import { pref, PX_UNIT } from '@weasel-js/prefs';

type AnyNode = SceneNode<unknown, string, unknown>;

/** Default reach of a click from the stroke it acts on, in screen pixels. */
export const DEFAULT_STROKE_REACH_PX = 6;

/** The `radiusPx` leaf of a click command's params form: how far its click reaches. */
export const strokeReachPref = () => pref.number('Reach', DEFAULT_STROKE_REACH_PX, {
  description: 'How near a stroke the click has to land to act on it.',
  min: 1, max: 30, step: 1, control: 'slider', unit: PX_UNIT,
});

type PressParams = (ImmediateParams & { radiusPx?: number }) | undefined;

/** A world point, and how far from it a stroke may be in world units. */
export interface StrokePress {
  at: { x: number; y: number };
  radius: number;
}

/** The press in `params` — a click's, or else a hover's pointer — and its
 *  reach, `radiusPx` at the view's scale; null with neither point. */
export function pressOf(deps: ActionDeps, params: unknown): StrokePress | null {
  const p = params as PressParams;
  const at = p?.press ?? p?.world;
  if (!at) return null;
  const scale = deps.view?.get().scale ?? { x: 1, y: 1 };
  const radius = pxReach(p?.radiusPx ?? DEFAULT_STROKE_REACH_PX, scale);
  return { at, radius };
}

type OrderedScene = Pick<Scene<unknown, string, unknown>, 'get'> & {
  renderOrderNodes?(): readonly AnyNode[];
  isLocked?(id: NodeId): boolean;
  isHidden?(id: NodeId): boolean;
};

function renderOrder(deps: ActionDeps | undefined): readonly AnyNode[] {
  const scene = deps?.scene as OrderedScene | undefined;
  return scene?.renderOrderNodes?.() ?? [];
}

/** `ids` with every container among them replaced by its leaves, depth first, less the locked and hidden ones. */
export function leavesOf(
  scene: { childrenOf?(id: NodeId): readonly NodeId[]; isLocked?(id: NodeId): boolean; isHidden?(id: NodeId): boolean },
  ids: readonly string[],
): NodeId[] {
  const out: NodeId[] = [];
  const visit = (id: NodeId) => {
    if (scene.isLocked?.(id) || scene.isHidden?.(id)) return;
    const kids = scene.childrenOf?.(id) ?? [];
    if (kids.length === 0) out.push(id);
    else kids.forEach(visit);
  };
  ids.forEach((id) => visit(id as NodeId));
  return out;
}

const drawn = (scene: OrderedScene | undefined, id: string) => !scene?.isHidden?.(id as NodeId);

/** Every leaf of the scene holding an editable path that is drawn and not
 *  locked, back to front: what a gesture with nothing selected may change. */
export function scenePathNodes(deps: ActionDeps | undefined): PathNode[] {
  const scene = deps?.scene as OrderedScene | undefined;
  if (!scene) return [];
  const ids = renderOrder(deps).flatMap((n) => (drawn(scene, n.id) && !scene.isLocked?.(n.id) ? [n.id] : []));
  return pathNodesOf(scene, ids);
}

/** The drawn outline of every leaf but `id`, locked ones included: what a
 *  stroke is cut at or stopped by. */
export function strokesBesides(deps: ActionDeps | undefined, id: string): Path[] {
  const scene = deps?.scene as OrderedScene | undefined;
  const out: Path[] = [];
  for (const node of renderOrder(deps)) {
    if (node.kind !== 'mark' || node.id === id || !drawn(scene, node.id)) continue;
    const outline = nodeOutline(node, shownNodeOf(scene!, node.id)?.pose);
    if (outline) out.push(outline);
  }
  return out;
}
