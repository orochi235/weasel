/** A page's `DiagramData` moved as a whole: what puts page coordinates into the world. */
import type { Vec2 } from '@weasel-js/core/math';
import type { DataContainer, DataEdge, DiagramData, DiagramLabel } from '@weasel-js/diagram';

const shift = (p: Vec2, by: Vec2): Vec2 => ({ x: p.x + by.x, y: p.y + by.y });

function shiftPlacement(label: DiagramLabel, by: Vec2): DiagramLabel {
  return typeof label.at === 'object' ? { ...label, at: { near: shift(label.at.near, by) } } : label;
}

function shiftEdge(e: DataEdge, by: Vec2): DataEdge {
  return {
    ...e,
    ...(e.waypoints !== undefined ? { waypoints: e.waypoints.map((p) => shift(p, by)) } : {}),
    ...(e.routed !== undefined ? { routed: e.routed.map((p) => shift(p, by)) } : {}),
    ...(e.labelPlacement !== undefined ? { labelPlacement: shiftPlacement(e.labelPlacement, by) } : {}),
  };
}

const shiftContainer = (c: DataContainer, by: Vec2): DataContainer =>
  (c.box === undefined ? c : { ...c, box: { ...c.box, ...shift(c.box, by) } });

/** `data` with every node place, region box, waypoint, laid-out route, and label point moved by `by`. */
export function shiftData(data: DiagramData, by: Vec2): DiagramData {
  if (by.x === 0 && by.y === 0) return data;
  return {
    ...data,
    nodes: data.nodes.map((n) => (n.at === undefined ? n : { ...n, at: shift(n.at, by) })),
    edges: data.edges.map((e) => shiftEdge(e, by)),
    ...(data.containers !== undefined ? { containers: data.containers.map((c) => shiftContainer(c, by)) } : {}),
  };
}
