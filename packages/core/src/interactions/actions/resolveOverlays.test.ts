import { describe, expect, it } from 'vitest';
import type { DrawCommand } from '../../renderer';
import type { OngoingOverlay } from './invoker';
import { resolveOverlays, type ResolvedOverlay } from './resolveOverlays';

const CMD: DrawCommand = {
  kind: 'path',
  path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 },
  fill: { color: '#000' },
};

function only(overlays: OngoingOverlay[]): ResolvedOverlay | undefined {
  const out = resolveOverlays(overlays);
  return out[0];
}

const marquee = (
  start: { x: number; y: number },
  current: { x: number; y: number },
  shiftHeld = false,
): OngoingOverlay => ({ kind: 'marquee', start, current, shiftHeld });

describe('resolveOverlays — marquee', () => {
  it('normalizes the drag into a world AABB whichever way it was dragged', () => {
    const forward = only([marquee({ x: 10, y: 20 }, { x: 110, y: 80 })]);
    expect(forward).toMatchObject({
      kind: 'marquee',
      bounds: { x: 10, y: 20, width: 100, height: 60 },
    });
    const backward = only([marquee({ x: 110, y: 80 }, { x: 10, y: 20 })]);
    expect(backward).toMatchObject({
      kind: 'marquee',
      bounds: { x: 10, y: 20, width: 100, height: 60 },
    });
  });

  it('carries shiftHeld, which the 2D layer does not paint', () => {
    expect(only([marquee({ x: 0, y: 0 }, { x: 5, y: 5 }, true)])).toMatchObject({
      shiftHeld: true,
    });
  });

  it('drops a zero-size marquee (pointerdown before the first move)', () => {
    expect(resolveOverlays([marquee({ x: 7, y: 7 }, { x: 7, y: 7 })])).toEqual([]);
  });

  it('keeps a marquee that is degenerate on one axis only', () => {
    expect(resolveOverlays([marquee({ x: 0, y: 0 }, { x: 0, y: 9 })])).toHaveLength(1);
  });
});

describe('resolveOverlays — lasso', () => {
  const lasso = (vertices: { x: number; y: number }[]): OngoingOverlay => ({
    kind: 'lasso',
    vertices,
    current: vertices[vertices.length - 1] ?? { x: 0, y: 0 },
    shiftHeld: false,
  });

  it('passes the vertex trail through', () => {
    const verts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    expect(only([lasso(verts)])).toMatchObject({ kind: 'lasso', vertices: verts });
  });

  it('drops a lasso under 2 vertices', () => {
    expect(resolveOverlays([lasso([{ x: 0, y: 0 }])])).toEqual([]);
    expect(resolveOverlays([lasso([])])).toEqual([]);
  });
});

describe('resolveOverlays — insertPreview', () => {
  const insert = (
    shape: string,
    bounds: { x: number; y: number; width: number; height: number },
    extras: unknown = {},
    anchorPoint?: { x: number; y: number },
  ): OngoingOverlay =>
    ({ kind: 'insertPreview', shape, bounds, extras, anchorPoint }) as OngoingOverlay;

  it('resolves a rect through insertPreviewExtent as box geometry', () => {
    expect(only([insert('rect', { x: 1, y: 2, width: 30, height: 40 })])).toMatchObject({
      kind: 'insertPreview',
      shape: 'rect',
      bounds: { x: 1, y: 2, width: 30, height: 40 },
      geometry: { kind: 'box' },
    });
  });

  it('resolves a polygon to its center/radius, not the drag rect', () => {
    const resolved = only([
      insert(
        'polygon',
        { x: 0, y: 0, width: 20, height: 20 },
        { center: { x: 10, y: 10 }, radius: 14, sides: 5, rotation: 0 },
      ),
    ]);
    expect(resolved).toMatchObject({
      geometry: { kind: 'polygon', center: { x: 10, y: 10 }, radius: 14, sides: 5 },
      bounds: { x: -4, y: -4, width: 28, height: 28 },
    });
  });

  it('drops a zero-area insert for a non-pencil shape', () => {
    expect(resolveOverlays([insert('rect', { x: 5, y: 5, width: 0, height: 0 })])).toEqual([]);
  });

  it('keeps a zero-area pencil — a closed loop sweeps no AABB but is real', () => {
    const samples = [
      { x: 5, y: 5 },
      { x: 5, y: 5 },
    ];
    expect(
      resolveOverlays([insert('pencil', { x: 5, y: 5, width: 0, height: 0 }, { samples })]),
    ).toHaveLength(1);
  });

  it('drops a pencil with fewer than 2 samples — a polyline needs two points', () => {
    expect(
      resolveOverlays([
        insert('pencil', { x: 5, y: 5, width: 0, height: 0 }, { samples: [{ x: 5, y: 5 }] }),
      ]),
    ).toEqual([]);
  });

  it('carries the anchor point, and withholds it from a pencil', () => {
    const anchor = { x: 3, y: 4 };
    expect(
      only([insert('rect', { x: 0, y: 0, width: 10, height: 10 }, {}, anchor)]),
    ).toMatchObject({ anchorPoint: anchor });
    const pencil = only([
      insert(
        'pencil',
        { x: 0, y: 0, width: 10, height: 10 },
        {
          samples: [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
          ],
        },
        anchor,
      ),
    ]);
    expect(pencil && 'anchorPoint' in pencil && pencil.anchorPoint).toBeFalsy();
  });

  it('passes extras through, so a renderer can reach an image src', () => {
    const extras = { kind: 'image', src: 'photo.png' };
    expect(
      only([insert('image', { x: 0, y: 0, width: 10, height: 10 }, extras)]),
    ).toMatchObject({ extras });
  });
});

describe('resolveOverlays — commands', () => {
  it('passes the command list through, marked opaque, defaulting to world space', () => {
    expect(only([{ kind: 'commands', commands: [CMD] }])).toEqual({
      kind: 'commands',
      visibilityId: 'action.commands',
      opaque: true,
      commands: [CMD],
      space: 'world',
    });
  });

  it('keeps an explicit screen space', () => {
    expect(only([{ kind: 'commands', commands: [CMD], space: 'screen' }])).toMatchObject({
      space: 'screen',
    });
  });

  it('drops an empty command list', () => {
    expect(resolveOverlays([{ kind: 'commands', commands: [] }])).toEqual([]);
  });
});

describe('resolveOverlays', () => {
  it('tags each variant with the chrome-caps id the gate consults', () => {
    const resolved = resolveOverlays([
      marquee({ x: 0, y: 0 }, { x: 1, y: 1 }),
      {
        kind: 'lasso',
        vertices: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        current: { x: 1, y: 1 },
        shiftHeld: false,
      },
      { kind: 'insertPreview', shape: 'rect', bounds: { x: 0, y: 0, width: 1, height: 1 }, extras: {} },
      { kind: 'commands', commands: [CMD] },
    ]);
    expect(resolved.map((r) => r.visibilityId)).toEqual([
      'action.marquee',
      'action.lasso',
      'action.insert-preview',
      'action.commands',
    ]);
  });

  it('preserves source order and skips only the degenerate entries', () => {
    const resolved = resolveOverlays([
      marquee({ x: 0, y: 0 }, { x: 0, y: 0 }),
      { kind: 'commands', commands: [CMD] },
      marquee({ x: 0, y: 0 }, { x: 4, y: 4 }),
    ]);
    expect(resolved.map((r) => r.kind)).toEqual(['commands', 'marquee']);
  });

  it('accepts any iterable, and answers with nothing for an empty one', () => {
    expect(resolveOverlays([])).toEqual([]);
    expect(resolveOverlays(new Set<OngoingOverlay>())).toEqual([]);
  });
});
