import { describe, it, expect } from 'vitest';
import { outlinePolyline, portsOnOutline, rayHit } from './onOutline';
import { portsOf } from './ports';
import type { Bounds } from './outline';
import type { Port } from './types';

const BOX: Bounds = { x: 0, y: 0, width: 100, height: 40 };
const CENTER = { x: 50, y: 20 };

const port = (x: number, y: number): Port =>
  ({ id: 'p', nodeId: 'n', point: { x, y }, normal: null });

describe('outlinePolyline', () => {
  it('walks a rect as a closed ring', () => {
    expect(outlinePolyline('rect', BOX))
      .toEqual([0, 0, 100, 0, 100, 40, 0, 40, 0, 0]);
  });

  it('closes a polygon that did not repeat its first point', () => {
    const poly = outlinePolyline('diamond', BOX);
    expect(poly.slice(0, 2)).toEqual(poly.slice(-2));
  });

  it('flattens a stadium\'s curves into many segments', () => {
    expect(outlinePolyline('stadium', BOX).length).toBeGreaterThan(20);
  });
});

describe('rayHit', () => {
  const square = [0, 0, 100, 0, 100, 100, 0, 100, 0, 0];

  it('finds where a ray leaves the shape', () => {
    expect(rayHit(square, { x: 50, y: 50 }, { x: 200, y: 50 })).toEqual({ x: 100, y: 50 });
  });

  it('reaches the boundary even when the probe is inside it', () => {
    expect(rayHit(square, { x: 50, y: 50 }, { x: 60, y: 50 })).toEqual({ x: 100, y: 50 });
  });

  it('takes the far crossing, so a concave outline attaches on its outside', () => {
    // A bowtie: the ray along y=50 crosses at x=20 and again at x=80.
    const bowtie = [0, 0, 20, 50, 0, 100, 80, 100, 80, 50, 80, 0, 0, 0];
    expect(rayHit(bowtie, { x: 10, y: 50 }, { x: 40, y: 50 })!.x).toBe(80);
  });

  it('answers null for a ray with no direction', () => {
    expect(rayHit(square, CENTER, CENTER)).toBeNull();
  });

  it('answers null when nothing is in the way', () => {
    expect(rayHit([0, 0, 1, 0], { x: 50, y: 50 }, { x: 50, y: 100 })).toBeNull();
  });
});

describe('portsOnOutline', () => {
  it('leaves a rect port where it was — the box is the shape', () => {
    expect(portsOnOutline([port(100, 20)], 'rect', BOX)[0]!.point).toEqual({ x: 100, y: 20 });
  });

  it("pulls a diamond's east port in to its vertex", () => {
    expect(portsOnOutline([port(100, 20)], 'diamond', BOX)[0]!.point).toEqual({ x: 100, y: 20 });
  });

  it("pulls a diamond's corner anchor onto an edge", () => {
    const moved = portsOnOutline([port(100, 0)], 'diamond', BOX)[0]!.point;
    expect(moved.x).toBeLessThan(100);
    expect(moved.y).toBeGreaterThan(0);
  });

  it('leaves a port with no direction to cast alone', () => {
    expect(portsOnOutline([port(50, 20)], 'diamond', BOX)[0]!.point).toEqual({ x: 50, y: 20 });
  });

  it('leaves everything alone for a zero-area node', () => {
    const ports = [port(0, 0)];
    expect(portsOnOutline(ports, 'diamond', { x: 0, y: 0, width: 0, height: 0 }))
      .toEqual(ports);
  });
});

describe('portsOf — on the outline', () => {
  const node = (outline: string) =>
    ({ id: 'n', kind: 'leaf' as const, data: { diagram: { outline } } });

  it("puts a parallelogram's west port on its sloped edge, not beside it", () => {
    const ports = portsOf(node('parallelogram'), BOX);
    const west = ports.find((p) => p.id === 'w')!;
    // The lean is a fifth of the width, so the west edge runs from x=20 at the
    // top to x=0 at the bottom; at mid-height it is x=10.
    expect(west.point.x).toBeCloseTo(10, 6);
    expect(west.point.y).toBeCloseTo(20, 6);
  });

  it("keeps a rect's ports on its bounds", () => {
    const ports = portsOf(node('rect'), BOX);
    expect(ports.find((p) => p.id === 'e')!.point).toEqual({ x: 100, y: 20 });
  });

  it('leaves a participant with no outline on its bounds', () => {
    const ports = portsOf({ id: 'n', kind: 'leaf', data: { diagram: {} } }, BOX);
    expect(ports.find((p) => p.id === 'w')!.point).toEqual({ x: 0, y: 20 });
  });
});
