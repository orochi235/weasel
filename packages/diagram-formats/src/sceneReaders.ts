/**
 * What `documentFromScene` reads off one scene node: a shape as a `DataNode`,
 * a connector as a `DataEdge`, a container or pool as a `DataContainer`, and a
 * group as a `DataGroup`, each in coordinates from its page's corner.
 */
import type { RectPose } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import {
  DEFAULT_PORTS, EDGE_STROKE_WIDTH, NODE_STROKE_WIDTH, dataEdgeStyle, dataNodeStyle, dataRegionStyle, diagramContainerOf, diagramEdgeOf, layoutOwnsPort,
  layoutOwnsRoute, poolAxisOf, titleIdOf, type DataContainer, type DataEdge, type DataGroup, type DataLane, type DataNode, type DiagramLabel,
  type DiagramRouter, type DiagramTheme, type EdgeStyle, type NodeStyle, type BodyDivider, type BodyLayout, type Row,
} from '@weasel-js/diagram';

/** A scene node as the readers see it. */
export interface ReadNode {
  id: string;
  parent: string | null;
  pose: unknown;
  data: unknown;
  dependsOn?: readonly string[] | 'children';
}

/** A scene as the readers see it. */
export interface ReadScene {
  get(id: never): ReadNode | undefined;
  childrenOf(id: never): readonly string[];
}

type Paint = { paint?: { color?: unknown }; width?: unknown; dash?: unknown; markerStart?: unknown; markerEnd?: unknown };
type Data = { diagram?: Record<string, unknown>; fill?: Paint; stroke?: Paint; text?: unknown; bodyRow?: unknown; style?: { fontSize?: unknown } };

const ROUTERS: readonly DiagramRouter[] = ['straight', 'bezier', 'orthogonal', 'avoid'];

const dataOf = (node: ReadNode | undefined): Data => ((node?.data ?? {}) as Data);
export const traitOf = (node: ReadNode): Record<string, unknown> | null => dataOf(node).diagram ?? null;
const colorOf = (paint: Paint | undefined): string | undefined => (typeof paint?.paint?.color === 'string' ? paint.paint.color : undefined);
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const moved = (p: Vec2, by: Vec2): Vec2 => ({ x: p.x - by.x, y: p.y - by.y });

/** What a scene node is to the document, or `null` for something drawn on another's behalf. */
export function kindOf(node: ReadNode): 'shape' | 'region' | 'group' | 'edge' | null {
  if (diagramEdgeOf(node) !== null) return 'edge';
  if (diagramContainerOf(node) !== null) return 'region';
  const trait = traitOf(node);
  if (trait === null) return null;
  if ('group' in trait) return 'group';
  return 'outline' in trait ? 'shape' : null;
}

/** The fields of `actual` its owner set by hand (`own`, its `ownStyle`), or that differ from `themed`. `undefined` for none. */
function ownColors<T extends object>(actual: Partial<T>, themed: Partial<T>, own: unknown): Partial<T> | undefined {
  const owned = new Set(Array.isArray(own) ? own : []);
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(actual) as [keyof T & string, T[keyof T & string] | undefined][]) {
    const field = key === 'label' ? 'text' : key;
    if (value !== undefined && (owned.has(field) || !same(value, themed[key]))) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

const textOf = (scene: ReadScene, id: string): string | undefined => {
  const text = dataOf(scene.get(id as never)).text;
  return typeof text === 'string' ? text : undefined;
};

/** Text rows and divider rows, each at its place. */
function withDividers(text: readonly { index: number; row: Row }[], dividers: readonly BodyDivider[]): Row[] {
  const all = [...text, ...dividers.map((d) => ({ index: d.index, row: (d.inset === undefined ? { kind: 'divider' } : { kind: 'divider', inset: d.inset }) as Row }))];
  return all.sort((a, b) => a.index - b.index).map((e) => e.row);
}

/** A shape: its outline, text rows, box, role, colors, and the body layout and ports it was built with. */
export function readShape(scene: ReadScene, node: ReadNode, page: Vec2, theme: DiagramTheme): DataNode {
  const trait = traitOf(node)!;
  const data = dataOf(node);
  const pose = node.pose as RectPose;
  const rows = scene.childrenOf(node.id as never).map((id) => scene.get(id as never)!)
    .filter((c) => typeof dataOf(c).text === 'string' && typeof dataOf(c).bodyRow === 'number')
    .sort((p, q) => (dataOf(p).bodyRow as number) - (dataOf(q).bodyRow as number));
  const ownSize = Array.isArray(trait.ownFont) && trait.ownFont.includes('size');
  const themed = dataNodeStyle({ style: trait.style as string | undefined }, theme);
  const colors = ownColors<NodeStyle>({
    fill: colorOf(data.fill), stroke: colorOf(data.stroke), text: colorOf(dataOf(rows[0]).fill),
    strokeWidth: data.stroke?.width as number | undefined, dash: data.stroke?.dash as number[] | undefined,
  }, { ...themed, strokeWidth: themed.strokeWidth ?? NODE_STROKE_WIDTH }, trait.ownStyle);
  const body = trait.body as BodyLayout | undefined;
  const dividers = body?.dividers ?? [];
  return {
    id: node.id,
    outline: trait.outline as DataNode['outline'],
    ...(ownSize || dividers.length > 0
      ? { rows: withDividers(rows.map((r) => ({
          index: dataOf(r).bodyRow as number,
          row: { kind: 'label' as const, text: dataOf(r).text as string, ...(ownSize ? { style: { fontSize: dataOf(r).style?.fontSize as number } } : {}) },
        })), dividers) }
      : { lines: rows.map((r) => dataOf(r).text as string) }),
    at: moved(pose, page),
    width: pose.width,
    height: pose.height,
    ...(typeof trait.style === 'string' ? { style: trait.style } : {}),
    ...(colors !== undefined ? { colors } : {}),
    ...(trait.pinned === true ? { pinned: true } : {}),
    ...(body !== undefined ? { padding: body.padding, gap: body.gap, verticalAlign: body.verticalAlign } : {}),
    ...(trait.ports !== undefined && !same(trait.ports, DEFAULT_PORTS) ? { ports: trait.ports as DataNode['ports'] } : {}),
  };
}

/** A label's placement, its near point moved onto the page. */
function placementOf(trait: Record<string, unknown> | null, page: Vec2): DiagramLabel | undefined {
  const label = trait?.label as DiagramLabel | undefined;
  if (label === undefined) return undefined;
  const at = typeof label.at === 'object' ? { near: moved(label.at.near, page) } : label.at;
  return { at, ...(label.offset !== undefined ? { offset: label.offset } : {}), ...(label.dodge === false ? { dodge: false } : {}) };
}

/**
 * A connector: its ends, the ports and route its author set, those layout or
 * the avoiding router set as `routedPorts` and `routed`, its label, and its
 * colors. `page` is `null` for one whose ends sit on different pages, which
 * keeps no route.
 */
export function readEdge(node: ReadNode, label: ReadNode | undefined, page: Vec2 | null, theme: DiagramTheme): DataEdge {
  const trait = diagramEdgeOf(node)!;
  const [from, to] = node.dependsOn as readonly string[];
  const router = ROUTERS.find((r) => r === trait.router) ?? 'straight';
  const authored = (end: typeof trait.from) => (end.port !== undefined && !layoutOwnsPort(end) ? end.port : undefined);
  const laid = (end: typeof trait.from) => (end.port !== undefined && layoutOwnsPort(end) ? end.port : undefined);
  const points = trait.waypoints !== undefined && trait.waypoints.length > 0 ? trait.waypoints : undefined;
  const routed = points !== undefined ? (layoutOwnsRoute(trait) ? points : undefined) : trait.route;
  const stroke = dataOf(node).stroke;
  const themed = dataEdgeStyle({ style: trait.style }, theme);
  const colors = ownColors<EdgeStyle>({
    stroke: colorOf(stroke), label: label === undefined ? undefined : colorOf(dataOf(label).fill),
    width: stroke?.width as number | undefined, dash: stroke?.dash as number[] | undefined,
    markerStart: (stroke?.markerStart ?? null) as EdgeStyle['markerStart'], markerEnd: (stroke?.markerEnd ?? null) as EdgeStyle['markerEnd'],
  }, {
    ...themed, width: themed.width ?? EDGE_STROKE_WIDTH, markerStart: themed.markerStart ?? null,
    markerEnd: themed.markerEnd === undefined ? 'arrow' : themed.markerEnd,
  }, trait.ownStyle);
  const text = label === undefined ? undefined : dataOf(label).text;
  const placement = label === undefined || page === null ? undefined : placementOf(traitOf(label), page);
  const fromPort = authored(trait.from);
  const toPort = authored(trait.to);
  const routedPorts = { ...(laid(trait.from) ? { from: laid(trait.from) } : {}), ...(laid(trait.to) ? { to: laid(trait.to) } : {}) };
  return {
    id: node.id, from: from!, to: to!, router,
    ...(fromPort !== undefined ? { fromPort } : {}),
    ...(toPort !== undefined ? { toPort } : {}),
    ...(page !== null && Object.keys(routedPorts).length > 0 ? { routedPorts } : {}),
    ...(page !== null && points !== undefined && routed === undefined ? { waypoints: points.map((p) => moved(p, page)) } : {}),
    ...(page !== null && routed !== undefined && routed.length > 0 ? { routed: routed.map((p) => moved(p, page)) } : {}),
    ...(typeof text === 'string' && text !== '' ? { label: text } : {}),
    ...(placement !== undefined ? { labelPlacement: placement } : {}),
    ...(trait.style !== undefined ? { style: trait.style } : {}),
    ...(colors !== undefined ? { colors } : {}),
  };
}

/** The colors a region shows that `themed` does not give it: its box's, and its title's as `text`. */
function regionColors(scene: ReadScene, node: ReadNode, themed: NodeStyle): Partial<NodeStyle> | undefined {
  const data = dataOf(node);
  const title = scene.get(titleIdOf(node.id) as never);
  return ownColors<NodeStyle>(
    { fill: colorOf(data.fill), stroke: colorOf(data.stroke), text: title === undefined ? undefined : colorOf(dataOf(title).fill) },
    themed, traitOf(node)?.ownStyle,
  );
}

/** The shapes and containers directly inside a region, in the scene's order. */
function membersOf(scene: ReadScene, id: string): string[] {
  return scene.childrenOf(id as never).filter((c) => {
    const node = scene.get(c as never)!;
    const kind = kindOf(node);
    return kind === 'shape' || (kind === 'region' && diagramContainerOf(node)!.role === 'container');
  });
}

const optional = <K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } =>
  (value === undefined ? {} : { [key]: value }) as { [P in K]?: V };

/** A container or a pool: its title, members or lanes, box (none for a fitted container), role, and colors. */
export function readRegion(scene: ReadScene, node: ReadNode, page: Vec2, theme: DiagramTheme): DataContainer {
  const trait = traitOf(node)!;
  const container = diagramContainerOf(node)!;
  const role = container.role === 'pool' ? 'pool' : 'container';
  const style = trait.style as string | undefined;
  const themed = dataRegionStyle({ role, style }, theme);
  const pose = node.pose as RectPose;
  const members = role === 'container' ? membersOf(scene, node.id) : [];
  const axis = poolAxisOf(container);
  return {
    id: node.id,
    role,
    ...optional('label', textOf(scene, titleIdOf(node.id))),
    ...(members.length > 0 ? { members } : {}),
    ...(role === 'pool' ? { axis, lanes: lanesOf(scene, node.id, axis, theme) } : {}),
    ...(container.fitted === true ? {} : { box: { ...moved(pose, page), width: pose.width, height: pose.height } }),
    ...(trait.pinned === true ? { pinned: true } : {}),
    ...optional('style', style),
    ...optional('colors', regionColors(scene, node, themed)),
  };
}

function lanesOf(scene: ReadScene, poolId: string, axis: 'x' | 'y', theme: DiagramTheme): DataLane[] {
  const start = (p: RectPose) => (axis === 'y' ? p.y : p.x);
  const lanes = scene.childrenOf(poolId as never).map((id) => scene.get(id as never)!)
    .filter((n) => diagramContainerOf(n)?.role === 'lane')
    .sort((p, q) => start(p.pose as RectPose) - start(q.pose as RectPose));
  return lanes.map((lane, i) => {
    const pose = lane.pose as RectPose;
    const members = membersOf(scene, lane.id);
    return {
      id: lane.id,
      ...optional('label', textOf(scene, titleIdOf(lane.id))),
      size: axis === 'y' ? pose.height : pose.width,
      ...(members.length > 0 ? { members } : {}),
      ...optional('colors', regionColors(scene, lane, dataRegionStyle({ role: 'lane' }, theme, i))),
    };
  });
}

/** A group: the shapes and groups it is drawn around, and its label. */
export function readGroup(scene: ReadScene, node: ReadNode): DataGroup {
  const group = traitOf(node)!.group as { reorder?: 'x' | 'y' };
  const members = (Array.isArray(node.dependsOn) ? node.dependsOn : []).filter((id) => {
    const member = scene.get(id as never);
    return member !== undefined && kindOf(member) !== null && kindOf(member) !== 'edge';
  });
  return {
    id: node.id, members,
    ...optional('label', textOf(scene, `${node.id}/label`)),
    ...optional('reorder', group.reorder),
  };
}
