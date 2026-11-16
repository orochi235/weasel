/** `kit:text`'s answers to picking and culling: its ink, its bounds, and its blank-node silhouette. */
import { beforeEach, describe, expect, it } from 'vitest';
import { strokeOf } from '@weasel-js/paint';
import { findShapeBounds, findShapeInk, shapeCoversPoint, type SceneNode as Node } from '@weasel-js/core';
import { _resetShapePaintersForTests } from 'canvas/NodeShape';
import { withTextPainter } from '../testing/textPainter';

interface RectPose { x: number; y: number; width: number; height: number }

const POSE: RectPose = { x: 0, y: 0, width: 100, height: 100 };

/** {@link findShapeInk} without the stroke it reports, which the tests on `stroke` check. */
function reachOf(...args: Parameters<typeof findShapeInk>) {
  const ink = findShapeInk(...args);
  if (ink === null) return null;
  const { stroke: _stroke, ...reach } = ink;
  return reach;
}

beforeEach(() => _resetShapePaintersForTests());
withTextPainter();

describe('kit:text bounds', () => {
  it('has none, since only layout can bound text', () => {
    const n = { id: 'n', kind: 'mark', layer: 'main', pose: POSE, data: { text: 'hi' } } as unknown as Node<unknown, string, RectPose>;
    expect(findShapeBounds(n, POSE)).toBeNull();
  });
});

describe('kit:text silhouette of a blank node', () => {
  it('has no opinion, so the node stays pickable across its box', () => {
    // `kit:text` returns null for a node with no non-blank lines.
    const blank = { id: 't', kind: 'mark', layer: 'main', pose: POSE, data: { text: '   ' } } as unknown as Node<unknown, string, RectPose>;
    expect(shapeCoversPoint(blank, POSE, 50, 50)).toBe(true);
    expect(shapeCoversPoint(blank, POSE, 9999, 9999)).toBe(true);
  });
});

describe('findShapeInk — text', () => {
  const textNode = (data: Record<string, unknown>): Node<unknown, string, RectPose> => ({
    id: 't',
    kind: 'mark',
    layer: 'main',
    pose: { x: 0, y: 0, width: 100, height: 100 },
    data: { text: 'Away', ...data },
  } as unknown as Node<unknown, string, RectPose>);

  it('reports no stroke for text, whose stroke follows its glyphs', () => {
    expect(findShapeInk(textNode({ stroke: strokeOf('#000', 4) }), POSE)).not.toHaveProperty('stroke');
  });

  it('gives a stroked text node the same reach as any other kind', () => {
    expect(reachOf(textNode({ stroke: strokeOf('#000', 4) }), POSE))
      .toEqual({ filled: true, outset: 2, inset: 2 });
  });

  it('stays filled when no fill is declared — undeclared text is black text', () => {
    expect(reachOf(textNode({}), POSE))
      .toEqual({ filled: true, outset: 0, inset: 0 });
  });

  it('keeps outline-only text filled, unlike every other kind', () => {
    // `fill: null` paints no glyph fill, but the silhouette is line boxes
    // rather than glyph ink: reporting it unfilled would leave a word
    // grabbable at its line-box edge and nowhere near the letters.
    expect(reachOf(textNode({ fill: null, stroke: strokeOf('#000', 4) }), POSE))
      .toEqual({ filled: true, outset: 2, inset: 2 });
  });
});

