import { boundsOfPath, pathFromD, type Path } from '@weasel-js/geom';
import type { RectPose } from 'core/geometry/rectPose';
import type { AddNodeSpec } from 'core/scene/nodeTypes';
import type { StatedNodeFields } from 'core/scene/statedFields';
import { asNodeId, type NodeId } from 'core/scene/types';

/** Where {@link pathNode} puts the node, besides its data. */
export interface PathNodePlacement<TLayer extends string> extends StatedNodeFields {
  /** Default `'default'`. */
  layer?: TLayer;
  parent?: NodeId | string | null;
  /** Radians the node is turned about its box's middle. */
  rotation?: number;
  /** The box the path is drawn through, in the parent's frame. Default the
   *  path's own bounds. */
  pose?: RectPose;
}

/** A path node as {@link pathNode} builds it: what `createScene`'s `initial` and `Scene.add` take. */
export type PathNodeSpec<TData, TLayer extends string, TPath extends Path = Path> =
  AddNodeSpec<{ path: TPath } & TData, TLayer, RectPose> & { kind: 'mark'; id: NodeId };

type Empty = Record<never, never>;

/**
 * A mark holding its geometry in `data.path`, as the kit's shape tools store
 * one: posed at the path's bounds, so the default painter draws it and
 * `editAnchors` edits it in place. `d` is a built path or SVG path data;
 * `data` sits beside the path (`fill`, `stroke`, or anything else), and a
 * `path` it carries is replaced by `d`'s.
 */
export function pathNode<TData extends object = Empty, TLayer extends string = 'default', TPath extends Path = Path>(
  id: string, d: TPath, data?: TData, place?: PathNodePlacement<TLayer>,
): PathNodeSpec<TData, TLayer, TPath>;
export function pathNode<TData extends object = Empty, TLayer extends string = 'default'>(
  id: string, d: string, data?: TData, place?: PathNodePlacement<TLayer>,
): PathNodeSpec<TData, TLayer>;
export function pathNode<TData extends object, TLayer extends string>(
  id: string,
  d: Path | string,
  data?: TData,
  place: PathNodePlacement<TLayer> = {},
): PathNodeSpec<TData, TLayer> {
  const path = typeof d === 'string' ? pathFromD(d) : d;
  const { layer, parent, rotation, pose, ...stated } = place;
  const { x, y, width, height } = pose ?? boundsOfPath(path);
  const turn = rotation ?? pose?.rotation;
  return {
    kind: 'mark',
    id: asNodeId(id),
    layer: layer ?? ('default' as TLayer),
    pose: { x, y, width, height, ...(turn ? { rotation: turn } : {}) },
    data: { ...(data ?? ({} as TData)), path },
    ...(parent !== undefined ? { parent: parent === null ? null : asNodeId(parent) } : {}),
    ...stated,
  };
}
