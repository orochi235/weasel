/**
 * The gesture that makes a constraint link: Alt-drag an anchor of the open
 * path onto an anchor of another node, or onto one of its segments, and on
 * release the anchor is tied there by a link node — `coincident` with the
 * anchor, `onPath` on the segment. The drag itself is `editAnchors`'.
 */
import {
  type Action, type ActionDeps, type BindingOpts, type InvocationCtx, isAnchor, type OngoingHandle,
  type OngoingInvoker, resolveParams,
} from '@weasel-js/routing';
import {
  editAnchorSetTracked, pathAnchorPoints, pathToAnchors, segmentAt, segmentBetween, translateAnchorBy,
  type AnchorSet, type PathConstraint, type PolygonPath,
} from '@weasel-js/geom';
import {
  annotationLayerIds, commitOps, createInsertOp, editAnchorsAction, pathEditPathOf, pathOperationTags,
  type EditAnchorsDep, type NodeId, type Scene, type SceneNode,
} from '@weasel-js/core';
import { constraintLinkNode, constraintLinkOf } from './constraintLinks';

/** Params for `linkAnchor`. */
export interface LinkAnchorParams {
  /** The layer link nodes go on. Default: the scene's first annotation layer, else the edited node's. */
  layer?: string;
  /** Screen px within which the released anchor counts as on a target. Default 6. */
  reachPx?: number;
}

const DEFAULT_REACH_PX = 6;

type Point = { x: number; y: number };
type AnyScene = Scene<unknown, string, unknown>;

/** What the released anchor lands on: another node, the constraint tying it there in that node's own numbering, and the point. */
export interface LinkTarget {
  id: string;
  at: Point;
  /** `coincident`: the anchor it lands on; `onPath`: the segment's two anchors. */
  kind: 'coincident' | 'onPath';
  anchors: readonly [number] | readonly [number, number];
}

/** The flat index of anchor `i` of subpath `sub`. */
const flatIndex = (set: AnchorSet, sub: number, i: number) =>
  set.anchors.slice(0, sub).reduce((n, s) => n + s.length, 0) + i;

/** Where `p` lands on `path`: an anchor within `reach` world units, else a segment within it; null when neither. */
function landingOn(path: PolygonPath, p: Point, reach: number, scale: Point): Omit<LinkTarget, 'id'> | null {
  const anchors = pathAnchorPoints(path);
  let best = -1;
  let bestD = reach;
  anchors.forEach((a, i) => {
    const d = Math.hypot(a.x - p.x, a.y - p.y);
    if (d <= bestD) { best = i; bestD = d; }
  });
  if (best >= 0) return { kind: 'coincident', anchors: [best], at: { x: anchors[best].x, y: anchors[best].y } };
  const set = pathToAnchors(path) as AnchorSet;
  const hit = segmentAt(set, p.x, p.y, { tolerancePx: reach * Math.max(scale.x, scale.y), scale });
  if (!hit) return null;
  const count = set.anchors[hit.sub].length;
  const a = flatIndex(set, hit.sub, hit.segIdx);
  const b = flatIndex(set, hit.sub, (hit.segIdx + 1) % count);
  const segment = segmentBetween(path, a, b);
  return segment ? { kind: 'onPath', anchors: segment, at: { x: hit.x, y: hit.y } } : null;
}

/**
 * The node other than `editingId` that world point `p` lands on, read
 * through `dep`'s editable paths: the nearest anchor within `reachPx` screen
 * px, else a segment within it. Link nodes are passed over. Null when it
 * lands on nothing.
 */
export function linkTargetAt(
  scene: Pick<AnyScene, 'renderOrderNodes'>,
  dep: Pick<EditAnchorsDep, 'editingId' | 'getEditablePath'>,
  p: Point,
  reachPx: number,
  scale: Point = { x: 1, y: 1 },
): LinkTarget | null {
  const reach = reachPx / Math.min(scale.x, scale.y);
  const nodes = [...scene.renderOrderNodes()].reverse() as SceneNode<unknown, string, unknown>[];
  let coincident: LinkTarget | null = null;
  let onPath: LinkTarget | null = null;
  for (const node of nodes) {
    if (node.id === dep.editingId || constraintLinkOf(node.data)) continue;
    const path = dep.getEditablePath(node.id) as PolygonPath | null | undefined;
    if (path?.kind !== 'polygon') continue;
    const landed = landingOn(path, p, reach, scale);
    if (landed?.kind === 'coincident') coincident ??= { id: node.id, ...landed };
    else if (landed) onPath ??= { id: node.id, ...landed };
  }
  return coincident ?? onPath;
}

/** The link tying anchor `anchor` of a path of `count` anchors to `target`, numbered over the edited path then the target. */
export function linkConstraint(anchor: number, count: number, target: LinkTarget): PathConstraint {
  const [a, b] = target.anchors;
  return target.kind === 'coincident'
    ? { kind: 'coincident', anchors: [anchor, count + a] }
    : { kind: 'onPath', anchor, segment: [count + a, count + b!] };
}

const pressedAnchor = (ctx: InvocationCtx): number => {
  const m = ctx.drag?.affordance?.kind.match(/^anchor:(\d+)$/);
  return m ? parseInt(m[1], 10) : -1;
};

function linkLayer(scene: AnyScene, editedLayer: string, params: LinkAnchorParams | undefined): string {
  if (params?.layer) return params.layer;
  const [annotation] = annotationLayerIds(scene.layers);
  return annotation ?? editedLayer;
}

/** The ops that leave anchor `anchor` of `path`, the edit of the open node, on `target` and tied there. Empty when the dep cannot make them. */
function linkOps(deps: ActionDeps, path: PolygonPath, anchor: number, target: LinkTarget, params: LinkAnchorParams | undefined) {
  const dep = deps.editAnchors!;
  const scene = deps.scene as AnyScene;
  const edited = scene.get(dep.editingId as NodeId);
  const p = pathAnchorPoints(path)[anchor];
  if (!edited || !p || !dep.editOps) return [];
  const placed = editAnchorSetTracked(path, (set) => translateAnchorBy(set, anchor, target.at.x - p.x, target.at.y - p.y));
  const finalPath = placed?.path ?? path;
  const label = 'Link anchor';
  const edit = dep.editOps(dep.editingId, finalPath, label, placed?.origins);
  if (edit.length === 0) return [];
  const spec = constraintLinkNode<unknown>({
    layer: linkLayer(scene, edited.layer, params),
    nodes: [dep.editingId, target.id],
    constraint: linkConstraint(anchor, pathAnchorPoints(finalPath).length, target),
  });
  const node = { ...spec, id: scene.mintId(), parent: null } as SceneNode<unknown, string, unknown>;
  return [...edit, createInsertOp({ node, label })];
}

/**
 * Link anchor. With Alt held at the press, dragging an anchor of the open
 * path moves it as `editAnchors` does, snapping as it does; released on an
 * anchor of another node, or on one of its segments, within `reachPx`
 * (params: {@link LinkAnchorParams}), it lands exactly there and a link node
 * ties it — `coincident` with the anchor, `onPath` on the segment — in the
 * same undo step as the move. Released anywhere else it is a plain move.
 */
export const linkAnchorAction: Action & { requires: string[] } = {
  id: 'linkAnchor',
  label: 'Link anchor',
  tags: pathOperationTags('drag'),
  defaultBinding: [{
    spec: { kind: 'drag', target: { kindOf: isAnchor }, mods: { alt: true, shift: 'optional', ctrl: 'optional' } },
    opts: { id: 'linkAnchor.drag' },
  }],
  eligible: { capability: 'edits-anchors' },
  // `editAnchors` runs the drag, its plane mapping included.
  requires: [...new Set([...editAnchorsAction.requires, 'scene', 'applyOps', 'view'])] as Action['requires'] & string[],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const dep = ctx.deps.editAnchors;
      const anchor = pressedAnchor(ctx);
      if (!dep?.editingId || !ctx.deps.scene || anchor < 0) return {};
      const id = dep.editingId;
      const move = (editAnchorsAction.invoker as OngoingInvoker).start(ctx, opts);
      if (!move.onEnd || !move.previewPose) return move;
      return {
        ...move,
        kind: 'link-anchor',
        onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          const shown = reason === 'commit' && [...(move.previewIds?.() ?? [])].includes(id) ? move.previewPose!(id) : null;
          const node = dep.getNodeShape(id);
          const path = shown && node
            ? pathEditPathOf({ pose: shown, data: move.previewData?.(id) ?? node.data }, dep.extensions)
            : null;
          const p = path ? pathAnchorPoints(path)[anchor] : null;
          const params = resolveParams(opts?.params) as LinkAnchorParams | undefined;
          const scale = endCtx.deps.view?.get().scale;
          const target = p ? linkTargetAt(endCtx.deps.scene as AnyScene, dep, p, params?.reachPx ?? DEFAULT_REACH_PX, scale) : null;
          if (!path || !target) {
            move.onEnd!(endCtx, reason);
            return;
          }
          move.onEnd!(endCtx, 'cancel');
          const ops = linkOps(endCtx.deps, path, anchor, target, params);
          if (ops.length > 0) commitOps(endCtx.deps, ops, 'Link anchor');
        },
      };
    },
  },
};
