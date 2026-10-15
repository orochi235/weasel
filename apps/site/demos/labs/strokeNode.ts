import { asNodeId, boundsOfPath, solid, type Path } from '@weasel-js/core';

/** A path leaf for the path-editing labs: stroked in `color`, and filled
 *  with a tint of it when `filled`. */
export function strokeNode(id: string, path: Path, color: string, filled = false) {
  const { x, y, width, height } = boundsOfPath(path);
  return {
    id: asNodeId(id),
    kind: 'leaf' as const,
    layer: 'default' as const,
    parent: null,
    pose: { x, y, width, height },
    data: {
      path,
      fill: filled ? { paint: solid(`${color}33`) } : null,
      stroke: { paint: solid(color), width: 2 },
    },
  };
}
