/**
 * Perimeter port labels: where the text naming a port is drawn, and how far
 * past its node that reaches.
 *
 * A label sits outside the node, on the port's own face, and to one side of
 * the line the port's wire leaves along, so the wire does not run through it.
 * A port inside a row draws its label inside the box instead; that is a
 * `ports` row's job, not this module's.
 */
import type { Vec2 } from '@weasel-js/core/math';
import type { GroupInset } from './cluster';
import type { Bounds } from './outline';
import { portsOf } from './ports';
import type { DiagramNode, Port, PortSpec } from './types';

/** Between a port and the near sides of its label, in world units. */
export const PORT_LABEL_GAP = 4;

const EPS = 1e-6;

/**
 * Where a label `size` big goes for a port at `point` facing `normal`.
 *
 * A port on a left or right face gets its label outside that face, above its
 * wire; one on a top or bottom face, outside that face, right of its wire; a
 * corner port, off the corner. A port with no direction gets it centered
 * above.
 */
export function portLabelBox(
  port: { point: Vec2; normal: Vec2 | null },
  size: { width: number; height: number },
  gap = PORT_LABEL_GAP,
): Bounds {
  const { point: p, normal: n } = port;
  const { width, height } = size;
  if (n === null) return { x: p.x - width / 2, y: p.y - gap - height, width, height };
  const outX = n.x > 0 ? p.x + gap : p.x - gap - width;
  const outY = n.y > 0 ? p.y + gap : p.y - gap - height;
  const lean = Math.abs(n.x) - Math.abs(n.y);
  if (lean > EPS) return { x: outX, y: p.y - gap / 2 - height, width, height };
  if (lean < -EPS) return { x: p.x + gap / 2, y: outY, width, height };
  return { x: outX, y: outY, width, height };
}

/** Where a built body's perimeter port label sits, as `buildBody`'s
 *  `portLabel` is handed it. */
export interface PerimeterPortLabelBox extends Bounds {
  port: PortSpec;
  side: 'outside';
}

/** A labeled port, resolved, and the box its label is drawn in. */
export interface PortLabelPlacement {
  port: Port & { label: string };
  box: Bounds;
}

/** Every labeled port of `trait` resolved against `bounds`, with its label's
 *  box. `size` measures one label. */
export function portLabelsOf(
  trait: DiagramNode,
  bounds: Bounds,
  size: (text: string) => { width: number; height: number },
): PortLabelPlacement[] {
  const out: PortLabelPlacement[] = [];
  for (const port of portsOf({ id: '', kind: 'container', data: null }, bounds, { read: () => trait })) {
    if (port.label === undefined) continue;
    const labeled = port as Port & { label: string };
    out.push({ port: labeled, box: portLabelBox(labeled, size(labeled.label)) });
  }
  return out;
}

/** How far `boxes` reach past `bounds` on each side; `undefined` for none. */
export function marginOf(bounds: Bounds, boxes: readonly Bounds[]): GroupInset | undefined {
  if (boxes.length === 0) return undefined;
  const m: GroupInset = { top: 0, right: 0, bottom: 0, left: 0 };
  for (const b of boxes) {
    m.top = Math.max(m.top, bounds.y - b.y);
    m.left = Math.max(m.left, bounds.x - b.x);
    m.right = Math.max(m.right, b.x + b.width - (bounds.x + bounds.width));
    m.bottom = Math.max(m.bottom, b.y + b.height - (bounds.y + bounds.height));
  }
  return m;
}

/** `ports` with each one `labels` names given that label. */
export function withLabels(ports: readonly PortSpec[], labels: Readonly<Record<string, string>> | undefined): PortSpec[] {
  if (labels === undefined) return [...ports];
  return ports.map((p) => (Object.hasOwn(labels, p.id) ? { ...p, label: labels[p.id]! } : p));
}
