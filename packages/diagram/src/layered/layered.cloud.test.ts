import { describe, expect, it } from 'vitest';
import { DEFAULT_GROUP_INSET } from '../cluster';
import { diagramScene } from '../fromData';
import { DEFAULT_NODE_GAP } from '../layout';
import { CLOUD } from './cloudFixture';
import { routedWires } from './overlaps';

type Rect = { x: number; y: number; width: number; height: number };

describe('layered on a grouped cloud architecture', () => {
  const specs = diagramScene(CLOUD);
  const box = (id: string) => specs.find((s) => s.id === id)!.pose as Rect;

  it.each(CLOUD.groups!.map((g) => [g.id, g.members] as const))('%s: its members share one rank', (_, members) => {
    const centers = members.map((m) => box(m).y + box(m).height / 2);
    for (const c of centers) expect(c).toBeCloseTo(centers[0]!, 6);
  });

  it.each(CLOUD.groups!.map((g) => [g.id, g.members] as const))('%s: its box holds no empty room', (id, members) => {
    const boxes = members.map(box);
    const lo = Math.min(...boxes.map((b) => b.x));
    const hi = Math.max(...boxes.map((b) => b.x + b.width));
    const packed = boxes.reduce((sum, b) => sum + b.width, 0) + (boxes.length - 1) * DEFAULT_NODE_GAP;
    expect(hi - lo).toBeLessThanOrEqual(packed + 1e-6);
    expect(box(id).width).toBeLessThanOrEqual(hi - lo + 2 * DEFAULT_GROUP_INSET + 1e-6);
  });

  it('routes no wire above the first rank or below the last', () => {
    const ys = CLOUD.nodes.flatMap((n) => [box(n.id).y, box(n.id).y + box(n.id).height]);
    const [top, bottom] = [Math.min(...ys), Math.max(...ys)];
    for (const wire of routedWires(specs)) {
      for (const p of wire.points) {
        expect(p.y).toBeGreaterThanOrEqual(top - 1);
        expect(p.y).toBeLessThanOrEqual(bottom + 1);
      }
    }
  });

  it('runs every wire from the gateway into a function inside the drawing rather than around it', () => {
    const rects = [...CLOUD.nodes.map((n) => box(n.id)), ...CLOUD.groups!.map((g) => box(g.id))];
    const lo = Math.min(...rects.map((r) => r.x));
    const hi = Math.max(...rects.map((r) => r.x + r.width));
    const grouped = new Set(CLOUD.groups!.flatMap((g) => g.members));
    const fromGateway = routedWires(specs).filter((w) => w.from === 'gateway' && grouped.has(w.to));
    expect(fromGateway).toHaveLength(11);
    for (const wire of fromGateway) {
      for (const p of wire.points) {
        expect(p.x).toBeGreaterThanOrEqual(lo - 1);
        expect(p.x).toBeLessThanOrEqual(hi + 1);
      }
    }
  });
});
