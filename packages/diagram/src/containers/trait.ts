/**
 * The container trait: what makes a core `ContainerNode` a diagram container,
 * a pool, or one of a pool's lanes, and where its header is.
 *
 * A container's title is a text child in its header, named
 * `<container id>/title`. The layouts find it by that name, because a layout
 * strategy sees only ids and poses.
 */
import type { RectPose } from '@weasel-js/core';
import type { Outline } from '../outline';
import { DIAGRAM_TRAIT_KEY } from '../trait';

/** Which kind of region a container is. */
export type ContainerRole = 'container' | 'pool' | 'lane';

/** The strip a container's title sits in, along one side. */
export interface ContainerHeader {
  side: 'top' | 'left';
  /** Its depth into the container, in world units. */
  size: number;
}

/** The container half of a diagram node's trait, under `data.diagram.container`. */
export interface DiagramContainer {
  role: ContainerRole;
  header?: ContainerHeader;
}

type Box = { x: number; y: number; width: number; height: number };

function traitOf(node: { data: unknown }): Record<string, unknown> | null {
  const data = node.data;
  if (data === null || typeof data !== 'object') return null;
  const trait = (data as Record<string, unknown>)[DIAGRAM_TRAIT_KEY];
  return trait !== null && typeof trait === 'object' ? (trait as Record<string, unknown>) : null;
}

/** The container trait on a node's data, or `null`. */
export function diagramContainerOf(node: { data: unknown }): DiagramContainer | null {
  const c = traitOf(node)?.container;
  return c !== null && typeof c === 'object' && typeof (c as DiagramContainer).role === 'string'
    ? (c as DiagramContainer)
    : null;
}

/** The outline a lane draws. A lane takes no connectors, so the participant
 *  reader passes over it, and the shape painter asks here instead. */
export function laneOutlineOf(node: { data: unknown }): Outline | undefined {
  if (diagramContainerOf(node)?.role !== 'lane') return undefined;
  return traitOf(node)?.outline as Outline | undefined;
}

/** The id of a container's title node. */
export const titleIdOf = (containerId: string): string => `${containerId}/title`;

/** The header strip of a container at `bounds`; null with no header. */
export function headerBox(bounds: Box, header: ContainerHeader | undefined): Box | null {
  if (header === undefined) return null;
  return header.side === 'top'
    ? { x: bounds.x, y: bounds.y, width: bounds.width, height: Math.min(header.size, bounds.height) }
    : { x: bounds.x, y: bounds.y, width: Math.min(header.size, bounds.width), height: bounds.height };
}

/** What a container at `bounds` holds members in: everything past its header. */
export function bodyBox(bounds: Box, header: ContainerHeader | undefined): Box {
  const h = headerBox(bounds, header);
  if (h === null) return { ...bounds };
  return header!.side === 'top'
    ? { x: bounds.x, y: bounds.y + h.height, width: bounds.width, height: bounds.height - h.height }
    : { x: bounds.x + h.width, y: bounds.y, width: bounds.width - h.width, height: bounds.height };
}

/** Where a container's title sits: its header strip, turned a quarter to run
 *  up a left header. */
export function titlePose(bounds: Box, header: ContainerHeader | undefined): RectPose {
  const h = headerBox(bounds, header) ?? { ...bounds, height: 0 };
  if (header?.side !== 'left') return { x: h.x, y: h.y, width: h.width, height: h.height };
  const cx = h.x + h.width / 2;
  const cy = h.y + h.height / 2;
  return { x: cx - h.height / 2, y: cy - h.width / 2, width: h.height, height: h.width, rotation: -Math.PI / 2 };
}
