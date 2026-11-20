import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/geometry/rectPose';
import { swappable } from './canSwap';

const box = (x: number, y: number, width = 10, height = 10): RectPose => ({ x, y, width, height });

function scene() {
  const s = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const a = s.add({ kind: 'mark', layer: 'main', data: {}, pose: box(0, 0) });
  const b = s.add({ kind: 'mark', layer: 'main', data: {}, pose: box(50, 0) });
  return { s: s as never, raw: s, a: a as string, b: b as string };
}

describe('swappable', () => {
  it('lets two marks of one size trade places, and not a node with itself', () => {
    const { s, a, b } = scene();
    expect(swappable(s, a, b)).toBe(true);
    expect(swappable(s, a, a)).toBe(false);
  });

  it('refuses another size, past a rounding error', () => {
    const { s, raw, a } = scene();
    const near = raw.add({ kind: 'mark', layer: 'main', data: {}, pose: box(80, 0, 10 + 1e-9, 10) });
    const wide = raw.add({ kind: 'mark', layer: 'main', data: {}, pose: box(80, 0, 12, 10) });
    expect(swappable(s, a, near)).toBe(true);
    expect(swappable(s, a, wide)).toBe(false);
  });

  it('refuses another kind', () => {
    const { s, raw, a } = scene();
    const g = raw.add({ kind: 'group', layer: 'main', data: {}, pose: box(80, 0) });
    expect(swappable(s, a, g)).toBe(false);
  });

  it('refuses a node and what is inside it, whatever canSwap says', () => {
    const { s, raw } = scene();
    const outer = raw.add({ kind: 'group', layer: 'main', data: {}, pose: box(0, 0, 40, 40) });
    const inner = raw.add({ kind: 'group', layer: 'main', data: {}, parent: outer, pose: box(5, 5, 40, 40) });
    expect(swappable(s, outer, inner, { canSwap: () => true })).toBe(false);
    expect(swappable(s, inner, outer, { canSwap: () => true })).toBe(false);
  });

  it('refuses a locked node', () => {
    const { s, raw, a, b } = scene();
    raw.setLocked(b as never, true);
    expect(swappable(s, a, b)).toBe(false);
  });

  it('asks canSwap in place of the kind and size rule', () => {
    const { s, raw, a, b } = scene();
    const wide = raw.add({ kind: 'mark', layer: 'main', data: {}, pose: box(80, 0, 30, 10) });
    expect(swappable(s, a, wide, { canSwap: () => true })).toBe(true);
    expect(swappable(s, a, b, { canSwap: (p, q) => p !== a && q !== a })).toBe(false);
  });

  it('measures through the poseDescriptor dep', () => {
    const { s, a, b } = scene();
    const byX = { getBounds: (p: RectPose) => ({ x: p.x, y: p.y, width: p.x + 1, height: 1 }) };
    expect(swappable(s, a, b, { poseDescriptor: byX as never })).toBe(false);
  });
});
