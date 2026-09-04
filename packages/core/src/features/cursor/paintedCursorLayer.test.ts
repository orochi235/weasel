import { describe, expect, it } from 'vitest';
import { GLYPHS } from '@weasel-js/cursor';
import { createPaintedCursorLayer } from './paintedCursorLayer';
import { createPaintedCursorState } from './paintedCursorState';
import type { PaintedCursor } from './paintedCursorState';
import type { DrawCommand, GroupDrawCommand, PathDrawCommand } from '../../renderer';

const VIEW = (scale = 1) => ({ x: 0, y: 0, scale: { x: scale, y: scale } });
const DIMS = { width: 800, height: 600 };

const BRUSH: PaintedCursor = { kind: 'painted', glyph: 'brush', angle: 0, worldRadius: 20 };

/** The layer emits one group; unwrap it. */
function group(cmds: DrawCommand[]): GroupDrawCommand {
  expect(cmds).toHaveLength(1);
  expect(cmds[0].kind).toBe('group');
  return cmds[0] as GroupDrawCommand;
}

/** Screen-space extent of the drawn glyph, from its transform and geometry. */
function drawnRadius(cmds: DrawCommand[]): number {
  const g = group(cmds);
  // Column-major [a, b, 0, c, d, 0, tx, ty, 1]; the uniform scale is |(a, b)|.
  const s = Math.hypot(g.transform![0], g.transform![1]);
  return (GLYPHS.brush.radius as number) * s;
}

describe('createPaintedCursorLayer', () => {
  it('draws nothing until a cursor and a pointer are both set', () => {
    const state = createPaintedCursorState();
    const layer = createPaintedCursorLayer(state);
    expect(layer.draw(null, VIEW(), DIMS)).toEqual([]);

    state.setBase(BRUSH);
    // A cursor with nowhere to be is not a cursor.
    expect(layer.draw(null, VIEW(), DIMS)).toEqual([]);

    state.setPointer(100, 50);
    expect(layer.draw(null, VIEW(), DIMS)).not.toEqual([]);
  });

  it('is screen-space, so the glyph does not pan with the camera', () => {
    // A world-space layer would have its commands wrapped in the view
    // transform by `drawLayers` and the cursor would slide off the pointer.
    expect(createPaintedCursorLayer(createPaintedCursorState()).space).toBe('screen');
  });

  it('puts the hotspot on the pointer', () => {
    const state = createPaintedCursorState();
    const layer = createPaintedCursorLayer(state);
    state.setBase(BRUSH);
    state.setPointer(140, 90);
    const g = group(layer.draw(null, VIEW(), DIMS));
    const [a, b, , c, d, , tx, ty] = g.transform!;
    const [hx, hy] = GLYPHS.brush.hotspot;
    expect(a * hx + c * hy + tx).toBeCloseTo(140);
    expect(b * hx + d * hy + ty).toBeCloseTo(90);
  });

  it('sizes a world-radius glyph against the live view scale', () => {
    // The reason this cursor cannot be baked: the answer changes on every
    // wheel tick, and a data-URI would have to be rebuilt for each one.
    const state = createPaintedCursorState();
    const layer = createPaintedCursorLayer(state);
    state.setBase(BRUSH);
    state.setPointer(0, 0);
    expect(drawnRadius(layer.draw(null, VIEW(1), DIMS))).toBeCloseTo(20);
    expect(drawnRadius(layer.draw(null, VIEW(3), DIMS))).toBeCloseTo(60);
  });

  it('holds a world-sized glyph line weight at chrome weight as it grows', () => {
    // Rendered width is the op width times the group scale. Without the
    // compensation a 200-unit brush ring carries a 30px stroke.
    const state = createPaintedCursorState();
    const layer = createPaintedCursorLayer(state);
    state.setPointer(0, 0);
    const widthAt = (worldRadius: number): number => {
      state.setBase({ kind: 'painted', glyph: 'brush', angle: 0, worldRadius });
      const g = group(layer.draw(null, VIEW(), DIMS));
      const s = Math.hypot(g.transform![0], g.transform![1]);
      const ink = g.children[g.children.length - 1] as PathDrawCommand;
      return (ink.stroke!.width as number) * s;
    };
    expect(widthAt(10)).toBeCloseTo(1.6);
    expect(widthAt(300)).toBeCloseTo(1.6);
  });

  it('scales a fixed-size glyph line weight, matching what a bake would show', () => {
    // The other half of the rule: where both tiers can draw a glyph they must
    // draw the same one, so a fixed size keeps weight proportional.
    const state = createPaintedCursorState();
    const layer = createPaintedCursorLayer(state);
    state.setPointer(0, 0);
    state.setBase({ kind: 'painted', glyph: 'rotate', angle: 0, size: 240 });
    const g = group(layer.draw(null, VIEW(), DIMS));
    const s = Math.hypot(g.transform![0], g.transform![1]);
    expect(s).toBeCloseTo(10);
    const arc = g.children[g.children.length - 3] as PathDrawCommand;
    // The authored 2.8-unit arc, ten times bigger.
    expect((arc.stroke!.width as number) * s).toBeCloseTo(28);
  });
});

describe('createPaintedCursorState', () => {
  it('lets an override win and restores the base when it clears', () => {
    const state = createPaintedCursorState();
    const base: PaintedCursor = { kind: 'painted', glyph: 'brush', angle: 0, worldRadius: 4 };
    const over: PaintedCursor = { kind: 'painted', glyph: 'rotate', angle: 0, size: 200 };
    state.setPointer(1, 1);
    state.setBase(base);
    expect(state.current()?.cursor).toBe(base);
    state.setOverride(over);
    expect(state.current()?.cursor).toBe(over);
    state.setOverride(null);
    expect(state.current()?.cursor).toBe(base);
  });

  it('stops drawing when the pointer leaves the surface', () => {
    const state = createPaintedCursorState();
    state.setBase({ kind: 'painted', glyph: 'brush', angle: 0, worldRadius: 4 });
    state.setPointer(5, 5);
    state.clearPointer();
    expect(state.current()).toBeNull();
  });

  it('does not wake the frame loop for pointer moves with nothing to paint', () => {
    // The pump runs on every idle pointermove. A notify per move with no
    // painted cursor set would request a redraw per pointer event for a
    // cursor the compositor is already drawing by itself.
    const state = createPaintedCursorState();
    let woke = 0;
    state.subscribe(() => { woke += 1; });
    state.setPointer(1, 1);
    state.setPointer(2, 2);
    expect(woke).toBe(0);

    state.setBase({ kind: 'painted', glyph: 'brush', angle: 0, worldRadius: 4 });
    woke = 0;
    state.setPointer(3, 3);
    expect(woke).toBe(1);
  });
});
