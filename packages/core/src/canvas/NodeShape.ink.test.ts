/**
 * Stroke-aware picking.
 *
 * `shapeCoversPoint` used to be a pure fill test, so "what you can click"
 * and "what is drawn" agreed only for filled shapes. An outlined rect with
 * no fill answered `true` through its empty middle and `false` on the ink;
 * a bare line, having no area at all, was unpickable outright.
 */
import { describe, expect, it } from 'vitest';
import { shapeCoversPoint, findShapeInk, registerNodeShape, findNodeShape } from './NodeShape';
import { solid, strokeOf } from '../util/paint';
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
    expect(findShapeInk(pathNode({ fill: solid('#f00') }), POSE))
      .toEqual({ filled: true, outset: 0, inset: 0 });
  });

  it('reports a stroke-only path as unfilled', () => {
    // Matches `paint`: no fill declared and a stroke present means the
    // painter emits no fill at all (the pencil case).
    expect(findShapeInk(pathNode({ stroke: strokeOf('#000', 2) }), POSE))
      .toEqual({ filled: false, outset: 1, inset: 1 });
  });

  it('treats fill: null as unfilled', () => {
    expect(findShapeInk(pathNode({ fill: null, stroke: strokeOf('#000', 3) }), POSE))
      .toEqual({ filled: false, outset: 1.5, inset: 1.5 });
  });

  it('treats stroke: null and zero width as unstroked', () => {
    expect(findShapeInk(pathNode({ fill: solid('#f00'), stroke: null }), POSE))
      .toMatchObject({ outset: 0, inset: 0 });
    expect(findShapeInk(pathNode({ fill: solid('#f00'), stroke: strokeOf('#000', 0) }), POSE))
      .toMatchObject({ outset: 0, inset: 0 });
  });

  it('falls back to a fill when neither fill nor stroke is declared', () => {
    expect(findShapeInk(pathNode({}), POSE)).toEqual({ filled: true, outset: 0, inset: 0 });
  });

  it('reports kit:shape as filled unless it declares fill: null', () => {
    const star = (data: Record<string, unknown>) => ({
      id: asNodeId('s'), kind: 'leaf', layer: 'main', pose: POSE,
      data: { shape: 'star', points: 5, stroke: strokeOf('#000', 6), ...data },
    } as unknown as Node<unknown, string, RectPose>);
    // No fill declared: the painter emits its default one, so the interior
    // is grabbable.
    expect(findShapeInk(star({}), POSE)).toEqual({ filled: true, outset: 3, inset: 3 });
    expect(findShapeInk(star({ fill: null }), POSE)).toEqual({ filled: false, outset: 3, inset: 3 });
  });
});

describe('shapeCoversPoint — filled shapes', () => {
  it('covers its interior', () => {
    expect(shapeCoversPoint(pathNode({ fill: solid('#f00') }), POSE, 50, 50)).toBe(true);
  });

  it('does not cover well outside itself', () => {
    expect(shapeCoversPoint(pathNode({ fill: solid('#f00') }), POSE, 200, 200)).toBe(false);
  });

  it('is grabbable just outside its edge once a tolerance is given', () => {
    const node = pathNode({ fill: solid('#f00') });
    expect(shapeCoversPoint(node, POSE, 103, 50)).toBe(false);
    expect(shapeCoversPoint(node, POSE, 103, 50, { tolerance: 4 })).toBe(true);
    expect(shapeCoversPoint(node, POSE, 110, 50, { tolerance: 4 })).toBe(false);
  });
});

describe('shapeCoversPoint — unfilled shapes are grabbed by their outline', () => {
  const outlined = pathNode({ fill: null, stroke: strokeOf('#000', 2) });

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
    // Stroke width 2 → half-width 1.
    expect(shapeCoversPoint(outlined, POSE, 100.5, 50)).toBe(true);
    expect(shapeCoversPoint(outlined, POSE, 102, 50)).toBe(false);
  });

  it('widens by the tolerance on top of the stroke', () => {
    expect(shapeCoversPoint(outlined, POSE, 104, 50, { tolerance: 4 })).toBe(true);
    expect(shapeCoversPoint(outlined, POSE, 106, 50, { tolerance: 4 })).toBe(false);
  });

  it('makes a hairline hittable, which its own width never could', () => {
    const hairline = pathNode({ fill: null, stroke: strokeOf('#000') });
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
    data: { path: linePath({ x: 0, y: 0 }, { x: 100, y: 100 }), stroke: strokeOf('#000', 2) },
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
      id: asNodeId('x'), kind: 'leaf', layer: 'main', pose: POSE, data: { fill: solid('#f00') },
    } as unknown as Node<unknown, string, RectPose>;
    expect(findShapeInk(opaque, POSE)).toBeNull();
    expect(shapeCoversPoint(opaque, POSE, 50, 50)).toBe(true);
    expect(shapeCoversPoint(opaque, POSE, 200, 200)).toBe(false);
  });
});

describe('findShapeInk — a Stroke object on the node', () => {
  const strokeNode = (stroke: unknown, extra: Record<string, unknown> = {}) =>
    pathNode({ fill: null, stroke, ...extra });

  it('takes the width off the stroke', () => {
    const n = strokeNode({ paint: { color: '#000' }, width: 10 });
    expect(findShapeInk(n, POSE)).toEqual({ filled: false, outset: 5, inset: 5 });
  });

  it('defaults a width-less Stroke to 1, as the renderer does', () => {
    expect(findShapeInk(strokeNode({ paint: { color: '#000' } }), POSE))
      .toEqual({ filled: false, outset: 0.5, inset: 0.5 });
  });

  it('gives an inner stroke no reach outside the outline, and an outer one none inside', () => {
    expect(findShapeInk(strokeNode({ paint: { color: '#000' }, width: 8, align: 'inner' }), POSE))
      .toEqual({ filled: false, outset: 0, inset: 8 });
    expect(findShapeInk(strokeNode({ paint: { color: '#000' }, width: 8, align: 'outer' }), POSE))
      .toEqual({ filled: false, outset: 8, inset: 0 });
  });

  it('resolves a { px } width against the view scale', () => {
    const n = strokeNode({ paint: { color: '#000' }, width: { px: 8 } });
    expect(findShapeInk(n, POSE, { scale: 2 })).toEqual({ filled: false, outset: 2, inset: 2 });
    // Without a scale, screen pixels are read as world units.
    expect(findShapeInk(n, POSE)).toEqual({ filled: false, outset: 4, inset: 4 });
  });

  it("passes a consumer painter's per-side ink straight through", () => {
    // `NodeInk` is the only shape a painter may return, so nothing is
    // normalized on the way out: asymmetric reach survives verbatim.
    const dispose = registerNodeShape(
      {
        id: 'test:custom-ink',
        matches: (n) => (n.data as { custom?: boolean } | null)?.custom === true,
        paint: () => [],
        silhouette: () => ({ kind: 'rect', x: 0, y: 0, width: 100, height: 100 }),
        ink: () => ({ filled: false, outset: 6, inset: 1 }),
      },
      { priority: 'high' },
    );
    try {
      expect(findShapeInk(pathNode({ custom: true }), POSE))
        .toEqual({ filled: false, outset: 6, inset: 1 });
    } finally {
      dispose();
    }
  });
});

describe('shapeCoversPoint — align decides which side is grabbable', () => {
  it('does not reach outside an inner stroke, and does reach well inside it', () => {
    const inner = pathNode({
      fill: null,
      stroke: { paint: { color: '#000' }, width: 8, align: 'inner' },
    });
    expect(shapeCoversPoint(inner, POSE, 102, 50)).toBe(false);
    expect(shapeCoversPoint(inner, POSE, 96, 50)).toBe(true);
  });

  it('does the opposite for an outer stroke', () => {
    const outer = pathNode({
      fill: null,
      stroke: { paint: { color: '#000' }, width: 8, align: 'outer' },
    });
    expect(shapeCoversPoint(outer, POSE, 106, 50)).toBe(true);
    expect(shapeCoversPoint(outer, POSE, 94, 50)).toBe(false);
  });
});

/**
 * A `Stroke` whose `paint` is missing.
 *
 * The type requires it, so nothing should ever build one — but a document is
 * data, and a stroke assembled field-by-field (a width written onto a node
 * that had no stroke) arrives here with no paint. It used to throw out of
 * `fillInPoseFrame`, and because the throw escapes the painter it takes the
 * whole frame with it: every other node and the document page vanish, and the
 * canvas stays stale until something unrelated asks for a redraw. One
 * malformed node must not be able to blank the document.
 */
describe('a stroke with no paint', () => {
  const paintless = { width: 2 } as unknown as ReturnType<typeof strokeOf>;

  it('paints the node without throwing', () => {
    const node = pathNode({ fill: solid('#f00'), stroke: paintless });
    expect(() => findNodeShape(node)!.paint(node, POSE)).not.toThrow();
  });

  it('emits no stroke — a stroke with no paint has nothing to draw', () => {
    const node = pathNode({ fill: solid('#f00'), stroke: paintless });
    const [cmd] = findNodeShape(node)!.paint(node, POSE);
    expect(cmd).not.toHaveProperty('stroke');
  });

  it('reaches no further than an unstroked node for picking', () => {
    // `ink` and `paint` have to agree, or a node is grabbable across a width
    // it does not draw.
    expect(findShapeInk(pathNode({ fill: solid('#f00'), stroke: paintless }), POSE))
      .toEqual({ filled: true, outset: 0, inset: 0 });
  });
});
