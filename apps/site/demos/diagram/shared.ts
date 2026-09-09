/**
 * What the four diagram demos have in common: the scene's types, the palette,
 * and a plain rect participant.
 *
 * Only the demos that are *about* bodies build one — everywhere else a
 * participant is a rect carrying an empty trait, which is all it takes: ports
 * default to the four edge midpoints of the node's own bounds, so a node has
 * to say nothing to be connectable.
 */
import type { AddNodeSpec, Stroke } from '@weasel-js/core';
import type { DiagramEdge, DiagramNode } from '@weasel-js/diagram';

export const INK = '#7ba7c7';
export const PORT = '#e0913f';
export const BODY_FILL = '#16222c';
export const LABEL = '#dbe7f2';

export interface Data {
  diagram?: DiagramNode | DiagramEdge;
  fill?: { color: string };
  stroke?: Stroke;
  text?: string;
  style?: { fontFamily: string; fontSize: number };
}

export interface Pose { x: number; y: number; width: number; height: number }

export type Spec = AddNodeSpec<Data, 'main', Pose>;

export const TEXT = { fontFamily: 'sans-serif', fontSize: 13 } as const;

/** A rect participant and its label, as one container with one text child.
 *
 *  The trait names an outline, so `registerDiagramShape`'s painter draws it —
 *  the same path a built body is drawn by, and what makes the stroke and the
 *  silhouette follow the shape rather than the bounding box. */
export function participant(id: string, at: Pose, text: string): Spec[] {
  return [
    {
      id: id as never,
      kind: 'container',
      layer: 'main',
      pose: at,
      data: {
        diagram: { outline: 'rect' },
        fill: { color: BODY_FILL },
        stroke: { paint: { color: INK }, width: 2 },
      },
    },
    {
      kind: 'leaf',
      layer: 'main',
      parent: id as never,
      pose: { x: at.x + 12, y: at.y + at.height / 2 - 8, width: at.width - 24, height: 16 },
      data: { text, style: TEXT, fill: { color: LABEL } },
    },
  ];
}
