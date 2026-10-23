/**
 * What `DiagramView` installs for `onEditContainer`: the container actions
 * with every commit swapped for a report, and the header double-click.
 */
import { isDiagramBody } from './bodyNode';
import type { Contribution, NodeId, RenderLayer, Scene } from '@weasel-js/core';
import { diagramContainers, laneResizeFrame, type LaneResize } from './containers/containerActions';
import { editContainerTitleAction, editContainerTitleBinding } from './containers/containerTitle';
import { poolsOf } from './containers/laneBoundaryLayer';
import { diagramContainerOf } from './containers/trait';
import { DEFAULT_LANE_SIZE } from './dataTypes';
import { laneList, type ContainerEdit } from './regionSync';
import type { NodeMove } from './sceneSync';

type AnyScene = Scene<unknown, string, unknown>;

/** Where region edits and the moves they bring about are reported. */
export interface RegionReports {
  onEditContainer?: ((edit: ContainerEdit) => void) | undefined;
  onMove?: ((moves: readonly NodeMove[], routes: readonly never[]) => void) | undefined;
}

/**
 * A lane resize as reports: the pool's lanes with the one resized, and, for
 * what the lanes after it carry, a node's move or a boxed region's box.
 */
export function laneResizeReports(scene: AnyScene, resize: LaneResize): { lanes: ContainerEdit; moves: NodeMove[]; boxes: ContainerEdit[] } | null {
  const pool = poolsOf(scene).find((p) => p.id === resize.poolId);
  const index = pool?.lanes.findIndex((l) => l.id === resize.laneId) ?? -1;
  if (pool === undefined || index < 0) return null;
  const lanes = laneList(scene, pool.id).map((l) => (l.id === resize.laneId ? { ...l, size: resize.size } : l));
  const moves: NodeMove[] = [];
  const boxes: ContainerEdit[] = [];
  for (const [id, pose] of laneResizeFrame(scene, pool, index, resize.size)) {
    const node = scene.get(id as NodeId);
    if (node === undefined) continue;
    const region = diagramContainerOf(node);
    const { x, y, width, height } = pose;
    if (region !== null) {
      if (region.role === 'container' && region.fitted !== true) boxes.push({ kind: 'box', id, box: { x, y, width, height } });
    } else if (isDiagramBody(node)) moves.push({ id, x, y });
  }
  return { lanes: { kind: 'lanes', pool: pool.id, lanes }, moves, boxes };
}

/** The lane layer and the contributions that report region edits through `reports`. */
export function regionEditing(
  scene: AnyScene,
  selected: () => readonly string[],
  reports: { readonly current: RegionReports },
): { layer: RenderLayer<unknown>; contributions: Contribution[] } {
  const edit = (e: ContainerEdit) => reports.current.onEditContainer?.(e);
  const containers = diagramContainers({
    scene,
    selected,
    commitResize: (resize) => {
      const out = laneResizeReports(scene, resize);
      if (out === null) return;
      edit(out.lanes);
      for (const box of out.boxes) edit(box);
      if (out.moves.length > 0) reports.current.onMove?.(out.moves, []);
    },
    commitAddLane: (poolId) => {
      const lanes = [...laneList(scene, poolId), { id: scene.mintId() as string, size: DEFAULT_LANE_SIZE }];
      edit({ kind: 'lanes', pool: poolId, lanes });
    },
    commitRelease: (id) => edit({ kind: 'release', id }),
  });
  const title: Contribution = {
    id: 'weasel-diagram-container-title',
    eligibility: { always: true },
    actions: [editContainerTitleAction((id) => edit({ kind: 'title', id }))],
    bindings: [editContainerTitleBinding()],
  };
  return { layer: containers.layer, contributions: [containers.contribution, title] };
}
