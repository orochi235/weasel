import { describe, expect, it } from 'vitest';
import { clampMove } from './clampMove';
import type { GestureContext, GroupTransform } from '@weasel-js/core/engine';

interface Pose { x: number; y: number; width: number; height: number }

function ctx(origin: Record<string, Pose>): GestureContext<Pose> {
  return {
    draggedIds: Object.keys(origin),
    origin: new Map(Object.entries(origin)),
    current: new Map(),
    snap: null,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
    view: null,
    adapter: {} as never,
    scratch: {},
  } as unknown as GestureContext<Pose>;
}

const t = (dx: number, dy: number): GroupTransform => ({ kind: 'translate', dx, dy });
const BOX = { x: 0, y: 0, width: 100, height: 50 };

describe('clampMove', () => {
  it('leaves a translation that stays inside alone', () => {
    const b = clampMove<Pose>({ bounds: BOX });
    expect(b.onMove!(ctx({ a: { x: 10, y: 10, width: 10, height: 10 } }), t(20, 5))).toBeUndefined();
  });

  it('stops the dragged box at each edge', () => {
    const b = clampMove<Pose>({ bounds: BOX });
    const c = ctx({ a: { x: 10, y: 10, width: 10, height: 10 } });
    expect(b.onMove!(c, t(500, -500))).toEqual({ transform: t(80, -10) });
    expect(b.onMove!(c, t(-500, 500))).toEqual({ transform: t(-10, 30) });
  });

  it('clamps a multi-node drag by the box around all of them', () => {
    const b = clampMove<Pose>({ bounds: () => BOX });
    const c = ctx({
      a: { x: 10, y: 10, width: 10, height: 10 },
      b: { x: 60, y: 20, width: 10, height: 10 },
    });
    expect(b.onMove!(c, t(100, 0))).toEqual({ transform: t(30, 0) });
  });
});

describe('clampMove with turned boxes', () => {
  const run = (bounds: Parameters<typeof clampMove<Pose>>[0]['bounds'], node: Pose, dx: number, dy: number) =>
    clampMove<Pose>({ bounds }).onMove!(ctx({ a: node }), t(dx, dy)) as { transform: { dx: number; dy: number } } | undefined;

  it('holds a node inside bounds drawn turned a quarter, as they are drawn', () => {
    // A 200 × 50 box turned a quarter about (100, 25) is drawn over x 75..125, y -75..125.
    const tall = { x: 0, y: 0, width: 200, height: 50, rotation: Math.PI / 2 };
    const node = { x: 95, y: 20, width: 10, height: 10 };
    expect(run(tall, node, 0, 90)).toBeUndefined();
    const r = run(tall, node, 100, 0)!;
    expect(r.transform.dx).toBeCloseTo(20);
    expect(r.transform.dy).toBeCloseTo(0);
  });

  it('measures a turned node by the box it draws', () => {
    // 100 × 10 turned a quarter about (100, 105) draws over x 95..105, y 55..155.
    const node = { x: 50, y: 100, width: 100, height: 10, rotation: Math.PI / 2 } as Pose;
    const square = { x: 0, y: 0, width: 200, height: 200 };
    expect(run(square, node, 0, 60)!.transform.dy).toBeCloseTo(45);
    expect(run(square, node, 150, 0)!.transform.dx).toBeCloseTo(95);
  });

  it('holds the nodes where they started inside bounds with a singular transform', () => {
    const flat = { ...BOX, transform: [1, 0, 0, 0] as const };
    expect(run(flat, { x: 10, y: 10, width: 5, height: 5 }, 5, 5)!.transform).toEqual({ kind: 'translate', dx: 0, dy: 0 });
  });
});
