/**
 * The node specs of a region — a container, a pool, or a lane — and its title,
 * which a stencil drawn on the canvas and a `DiagramData` container both build
 * from.
 */
import type { AddNodeSpec, NodeId, RectPose } from '@weasel-js/core';
import { NODE, type DiagramSceneData, type NodeStyle } from '../dataTypes';
import { DEFAULT_FONT } from '../edgeLabel';
import { CONTAINER_LAYOUTS, containerShape } from './layouts';
import { MIN_LANE_SIZE } from './laneStack';
import { titlePose } from './titlePose';
import { titleIdOf, type ContainerRole, type DiagramContainer } from './trait';

/** How many lanes a new pool starts with. */
const NEW_POOL_LANES = 2;

/** A region's node spec, always with an id. */
export type RegionSpec<TLayer extends string> = AddNodeSpec<DiagramSceneData, TLayer, RectPose> & { id: NodeId };

/** Options for `containerBuild`. */
export interface ContainerBuildOptions<TLayer extends string> {
  layer: TLayer;
  newId: () => string;
  /** The box's fill, stroke and title colors. Default `diagramScene`'s node style. */
  style?: NodeStyle;
  /** The container the new one goes in. Default the top level. */
  parent?: string | null;
  /** A pool's header colors and its lanes' bodies in turn. Default `style` for both. */
  laneStyles?: { header: NodeStyle; bodies: readonly NodeStyle[] };
}

/** Options for {@link regionSpecs}. */
export interface RegionOptions<TLayer extends string> {
  id: string;
  layer: TLayer;
  /** Default the top level. */
  parent?: string | null;
  /** Default `diagramScene`'s node style. */
  style?: NodeStyle;
  /** Marks a region whose box is fitted to its members each time it is built from data. */
  fitted?: boolean;
}

function regionData(role: ContainerRole, axis: 'x' | 'y', style: NodeStyle, fitted: boolean): DiagramSceneData {
  const container: DiagramContainer = { role, header: containerShape(role, axis).header, ...(fitted ? { fitted: true } : {}) };
  return {
    diagram: { outline: 'rect', container },
    ...(role === 'lane' ? {} : { fill: { paint: { color: style.fill } } }),
    stroke: { paint: { color: style.stroke }, width: role === 'lane' ? 1 : style.strokeWidth ?? 2 },
  };
}

const titleData = (text: string, style: NodeStyle): DiagramSceneData => ({
  text,
  style: { ...DEFAULT_FONT, fontSize: 13, fontWeight: 700, align: 'center' },
  verticalAlign: 'center',
  fill: { paint: { color: style.text } },
});

/** The node specs of one region, and its title unless `title` is null. */
export function regionSpecs<TLayer extends string>(
  role: ContainerRole, axis: 'x' | 'y', pose: RectPose, title: string | null, opts: RegionOptions<TLayer>,
): RegionSpec<TLayer>[] {
  const style = opts.style ?? NODE;
  const { layout, header } = containerShape(role, axis);
  const region: RegionSpec<TLayer> = {
    id: opts.id as NodeId, kind: 'container', layer: opts.layer, pose, parent: (opts.parent ?? null) as NodeId | null,
    data: regionData(role, axis, style, opts.fitted === true), layout: CONTAINER_LAYOUTS[layout],
  };
  if (title === null) return [region];
  return [region, {
    id: titleIdOf(opts.id) as NodeId, kind: 'leaf', layer: opts.layer, parent: opts.id as NodeId, pickable: false,
    pose: titlePose(pose, header), data: titleData(title, style),
  }];
}

/** The lane specs a new pool at `at` starts with. */
export function firstLanes<TLayer extends string>(
  poolId: string, axis: 'x' | 'y', at: RectPose, opts: ContainerBuildOptions<TLayer>,
): RegionSpec<TLayer>[] {
  const { header } = containerShape('pool', axis);
  const size = Math.max(MIN_LANE_SIZE, (axis === 'y' ? at.height : at.width) / NEW_POOL_LANES);
  const out: RegionSpec<TLayer>[] = [];
  for (let i = 0; i < NEW_POOL_LANES; i++) {
    const pose: RectPose = axis === 'y'
      ? { x: at.x + header.size, y: at.y + i * size, width: at.width - header.size, height: size }
      : { x: at.x + i * size, y: at.y + header.size, width: size, height: at.height - header.size };
    const bodies = opts.laneStyles?.bodies ?? [];
    const style = bodies.length > 0 ? bodies[i % bodies.length] : opts.style;
    out.push(...regionSpecs('lane', axis, pose, `Lane ${i + 1}`, {
      id: opts.newId(), layer: opts.layer, parent: poolId, ...(style ? { style } : {}),
    }));
  }
  return out;
}
