/**
 * Stroke-aware picking.
 *
 * `shapeCoversPoint` used to be a pure fill test, so "what you can click"
 * and "what is drawn" agreed only for filled shapes. An outlined rect with
 * no fill answered `true` through its empty middle and `false` on the ink;
 * a bare line, having no area at all, was unpickable outright.
 */
import { describe, expect, it } from 'vitest';
import { shapeCoversPoint, findShapeInk } from './NodeShape';
import { linePath } from 'features/paths/builder';
import type { Node } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';

interface RectPose { x: number; y: number; width: number; height: number }

function pathNode(data: Record<string, unknown>): Node<unknown, string, RectPose> {
  return {
    id: asNodeId('n'),
    kind: 'leaf',
    layer: 'main',
    pose: { x: 0, y: 0, width: 100, height: 100 },
    data: { path: { kind: 'rect', x: 0, y: 0, width: 100, height: 100 }, ...data },
  } as unknown as Node<unknown, string, RectPose>;
}

const POSE: RectPose = { x: 0, y: 0, width: 100, height: 100 };

describe('findShapeInk', () => {
  it('reports a filled path with no stroke', () => {
    expect(findShapeInk(pathNode({ fill: '#f00' }), POSE))
      .toEqual({ filled: true, strokeWidth: 0 });
  });

  it('reports a stroke-only path as unfilled', () => {
    // Matches `paint`: no fill/color declared and a stroke present means the
    // painter emits no fill at all (the pencil case).
    expect(findShapeInk(pathNode({ stroke: '#000', strokeWidth: 2 }), POSE))
      .toEqual({ filled: false, strokeWidth: 2 });
  });

  it("treats fill: 'none' as unfilled", () => {
    expect(findShapeInk(pathNode({ fill: 'none', stroke: '#000', strokeWidth: 3 }), POSE))
      .toEqual({ filled: false, strokeWidth: 3 });
  });

  it("treats stroke: 'none' and zero width as unstroked", () => {
    expect(findShapeInk(pathNode({ fill: '#f00', stroke: 'none', strokeWidth: 4 }), POSE))
      .toMatchObject({ strokeWidth: 0 });
    expect(findShapeInk(pathNode({ fill: '#f00', stroke: '#000', strokeWidth: 0 }), POSE))
      .toMatchObject({ strokeWidth: 0 });
  });

  it('falls back to a fill when neither fill nor stroke is declared', () => {
    expect(findShapeInk(pathNode({}), POSE)).toEqual({ filled: true, strokeWidth: 0 });
  });

  it('reports kit:shape as always filled, since its painter always fills', () => {
    const star = {
      id: asNodeId('s'), kind: 'leaf', layer: 'main', pose: POSE,
      data: { shape: 'star', points: 5, stroke: '#000', strokeWidth: 6 },
    } as unknown as Node<unknown, string, RectPose>;
    expect(findShapeInk(star, POSE)).toEqual({ filled: true, strokeWidth: 6 });
  });
});

describe('shapeCoversPoint — filled shapes', () => {
  it('covers its interior', () => {
    expect(shapeCoversPoint(pathNode({ fill: '#f00' }), POSE, 50, 50)).toBe(true);
  });

  it('does not cover well outside itself', () => {
    expect(shapeCoversPoint(pathNode({ fill: '#f00' }), POSE, 200, 200)).toBe(false);
  });

  it('is grabbable just outside its edge once a tolerance is given', () => {
    const node = pathNode({ fill: '#f00' });
    expect(shapeCoversPoint(node, POSE, 103, 50)).toBe(false);
    expect(shapeCoversPoint(node, POSE, 103, 50, { tolerance: 4 })).toBe(true);
    expect(shapeCoversPoint(node, POSE, 110, 50, { tolerance: 4 })).toBe(false);
  });
});

describe('shapeCoversPoint — unfilled shapes are grabbed by their outline', () => {
  const outlined = pathNode({ fill: 'none', stroke: '#000', strokeWidth: 2 });

  it('does NOT cover its empty interior', () => {
    // The bug: a fill test said yes here, so clicking the hole in an outlined
    // rect selected it and never fell through to whatever was underneath.
    expect(shapeCoversPoint(outlined, POSE, 50, 50)).toBe(false);
  });

  it('covers its outline', () => {
    // On the edge, within the stroke's half-width.
    expect(shapeCoversPoint(outlined, POSE, 0, 50)).toBe(true);
    expect(shapeCoversPoint(outlined, POSE, 100, 50)).toBe(true);
  });

  it('reaches half the stroke width past the edge', () => {
    // strokeWidth 2 → half-width 1.
    expect(shapeCoversPoint(outlined, POSE, 100.5, 50)).toBe(true);
    expect(shapeCoversPoint(outlined, POSE, 102, 50)).toBe(false);
  });

  it('widens by the tolerance on top of the stroke', () => {
    expect(shapeCoversPoint(outlined, POSE, 104, 50, { tolerance: 4 })).toBe(true);
    expect(shapeCoversPoint(outlined, POSE, 106, 50, { tolerance: 4 })).toBe(false);
  });

  it('makes a hairline hittable, which its own width never could', () => {
    const hairline = pathNode({ fill: 'none', stroke: '#000', strokeWidth: 1 });
    // Half a world unit of reach: two units off the edge and you've missed.
    expect(shapeCoversPoint(hairline, POSE, 52, 2)).toBe(false);
    expect(shapeCoversPoint(hairline, POSE, 52, 2, { tolerance: 4 })).toBe(true);
  });
});

describe('shapeCoversPoint — open paths', () => {
  const line = {
    id: asNodeId('l'),
    kind: 'leaf',
    layer: 'main',
    pose: POSE,
    data: { path: linePath({ x: 0, y: 0 }, { x: 100, y: 100 }), stroke: '#000', strokeWidth: 2 },
  } as unknown as Node<unknown, string, RectPose>;

  it('covers points along the line', () => {
    expect(shapeCoversPoint(line, POSE, 50, 50)).toBe(true);
  });

  it('does not cover the empty half of its bounding box', () => {
    // A line has no area, so a fill test could never pick it at all — and the
    // pose rect would have picked this corner, which is nowhere near the ink.
    expect(shapeCoversPoint(line, POSE, 90, 10, { tolerance: 4 })).toBe(false);
  });

  it('covers near-misses within the tolerance', () => {
    expect(shapeCoversPoint(line, POSE, 52, 50, { tolerance: 4 })).toBe(true);
  });
});

describe('shapeCoversPoint — painters with no opinion', () => {
  it('answers true for a node whose painter has no silhouette', () => {
    // `kit:text` returns null for a node with no non-blank lines, which is
    // the "no opinion" case: the caller's AABB pre-filter stays the answer,
    // so a silhouette-less painter can never make a node unpickable.
    const blank = {
      id: asNodeId('t'), kind: 'leaf', layer: 'main', pose: POSE,
      data: { text: '   ' },
    } as unknown as Node<unknown, string, RectPose>;
    expect(shapeCoversPoint(blank, POSE, 50, 50)).toBe(true);
    expect(shapeCoversPoint(blank, POSE, 9999, 9999)).toBe(true);
  });

  it('treats a painter that declares no ink as filled, unchanged from before', () => {
    // The rect fallback declares a silhouette but no `ink`, so it keeps the
    // pre-`ink` behavior: the whole interior is grabbable.
    const opaque = {
      id: asNodeId('x'), kind: 'leaf', layer: 'main', pose: POSE, data: { color: '#f00' },
    } as unknown as Node<unknown, string, RectPose>;
    expect(findShapeInk(opaque, POSE)).toBeNull();
    expect(shapeCoversPoint(opaque, POSE, 50, 50)).toBe(true);
    expect(shapeCoversPoint(opaque, POSE, 200, 200)).toBe(false);
  });
});
