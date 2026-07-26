import { describe, it, expect } from 'vitest';
import { sceneNodeClientRect } from './sceneNodeClientRect';
import type { Bounds } from './fitViewToBounds';

const fakeCanvas = (left: number, top: number): Element =>
  ({ getBoundingClientRect: () => ({ left, top }) }) as unknown as Element;

describe('sceneNodeClientRect', () => {
  const worldBounds = new Map<string, Bounds>([
    ['a', { x: 30, y: 40, width: 5, height: 6 }],
  ]);
  const getWorldBounds = (id: string) => worldBounds.get(id) ?? null;

  it('projects a world AABB through the view and canvas offset', () => {
    const rect = sceneNodeClientRect({
      id: 'a',
      getWorldBounds,
      view: { x: 10, y: 20, scale: { x: 2, y: 2 } },
      canvas: fakeCanvas(100, 50),
    });
    // screen = (world - view.origin) * scale → (20*2, 20*2) = (40, 40)
    expect(rect).toEqual({ x: 140, y: 90, width: 10, height: 12 });
  });

  it('respects per-axis scale', () => {
    const rect = sceneNodeClientRect({
      id: 'a',
      getWorldBounds,
      view: { x: 0, y: 0, scale: { x: 1, y: 3 } },
      canvas: fakeCanvas(0, 0),
    });
    expect(rect).toEqual({ x: 30, y: 120, width: 5, height: 18 });
  });

  it('returns null for an unknown id', () => {
    const rect = sceneNodeClientRect({
      id: 'nope',
      getWorldBounds,
      view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
      canvas: fakeCanvas(0, 0),
    });
    expect(rect).toBeNull();
  });
});
