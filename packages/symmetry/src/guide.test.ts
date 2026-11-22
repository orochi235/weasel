import { describe, expect, it } from 'vitest';
import type { View } from '@weasel-js/core';
import { boundsOfPath } from '@weasel-js/geom';
import { guideHandles, createSymmetryGuideLayer, type SymmetryHandlePress } from './guide';
import { symmetryHandleChange } from './handleDrag';
import { DEFAULT_SYMMETRY, HORIZONTAL_AXIS, type SymmetrySpec } from './kinds';

const VIEW: View = { x: 0, y: 0, scale: { x: 2, y: 2 } };
const C = { x: 50, y: 50 };
const DIMS = { width: 400, height: 400, dpr: 1 };
const spec = (over: Partial<SymmetrySpec>): SymmetrySpec => ({ ...DEFAULT_SYMMETRY, ...over });
const source = (s: SymmetrySpec) => ({ current: () => ({ group: 'g', spec: s, center: C }), subscribe: () => () => {} });

describe('guideHandles', () => {
  it('puts the knob along the axis, the set distance out on screen', () => {
    const [knob, center] = guideHandles(spec({ kind: 'mirror', angle: HORIZONTAL_AXIS }), C, VIEW, 64);
    expect(center).toEqual({ handle: 'center', at: { x: 100, y: 100 } });
    expect(knob).toEqual({ handle: 'angle', at: { x: 164, y: 100 } });
  });

  it('moves the knob out past the contents\' reach, measured on screen, with room for its hit circle', () => {
    const [knob] = guideHandles(spec({ kind: 'mirror', angle: HORIZONTAL_AXIS }), C, VIEW, 64, 40, 9);
    expect(knob).toEqual({ handle: 'angle', at: { x: 100 + 80 + 18, y: 100 } });
  });

  it('gives a radial kind only its center, since turning it changes nothing', () => {
    expect(guideHandles(spec({ kind: 'radial' }), C, VIEW, 64).map((h) => h.handle)).toEqual(['center']);
  });

  it('puts a repeat\'s step handle at the first repeat', () => {
    const [step] = guideHandles(spec({ kind: 'repeat', angle: 0, spacing: 30 }), C, VIEW, 64);
    expect(step).toEqual({ handle: 'step', at: { x: 160, y: 100 } });
  });

  it('gives a wallpaper a handle at its first step and its first row', () => {
    const wall = spec({ kind: 'wallpaper', angle: 0, spacing: 30, rowAngle: Math.PI / 2, rowSpacing: 20 });
    expect(guideHandles(wall, C, VIEW, 64)).toEqual([
      { handle: 'step', at: { x: 160, y: 100 } },
      { handle: 'row', at: { x: 100, y: 140 } },
      { handle: 'center', at: { x: 100, y: 100 } },
    ]);
  });
});

describe('createSymmetryGuideLayer', () => {
  it('claims a press on a handle, saying which, and nothing elsewhere on the line', () => {
    const layer = createSymmetryGuideLayer(source(spec({ kind: 'mirror', angle: HORIZONTAL_AXIS })));
    const hit = layer.hitTest!(50, 50, undefined, VIEW, DIMS);
    expect(hit?.strength).toBe('exclusive');
    expect(hit?.initialScratch).toEqual({ handle: 'center', group: 'g' });
    expect(layer.hitTest!(82, 50, undefined, VIEW, DIMS)?.initialScratch).toEqual({ handle: 'angle', group: 'g' });
    expect(layer.hitTest!(120, 50, undefined, VIEW, DIMS)).toBeNull();
  });

  it('draws the handle a press takes on top where two overlap', () => {
    // A step shorter than the hit radius puts the step handle over the center, and a press takes the step.
    const s = spec({ kind: 'repeat', angle: 0, spacing: 1 });
    const layer = createSymmetryGuideLayer(source(s));
    const hit = layer.hitTest!(C.x, C.y, undefined, VIEW, DIMS);
    expect((hit?.initialScratch as SymmetryHandlePress).handle).toBe('step');
    const dots = layer.draw(undefined, VIEW, DIMS).filter((c) => c.kind === 'path' && 'fill' in c && c.fill && c.stroke);
    const top = dots.at(-1)!;
    const b = boundsOfPath((top as { path: Parameters<typeof boundsOfPath>[0] }).path);
    expect(b.x + b.width / 2).toBeCloseTo(102);
  });

  it('outlines a wallpaper\'s extent', () => {
    const wall = spec({ kind: 'wallpaper', extent: { x: -10, y: -20, width: 30, height: 40 } });
    const draws = createSymmetryGuideLayer(source(wall)).draw(undefined, VIEW, DIMS);
    const outline = draws.find((d) => d.kind === 'path' && d.stroke?.dash);
    expect(outline?.kind === 'path' && boundsOfPath(outline.path)).toMatchObject({ x: 80, y: 60, width: 60, height: 80 });
  });

  it('draws nothing without an active group', () => {
    const layer = createSymmetryGuideLayer({ current: () => null, subscribe: () => () => {} });
    expect(layer.draw(undefined, VIEW, { width: 100, height: 100, dpr: 1 })).toEqual([]);
  });
});

describe('symmetryHandleChange', () => {
  const id = { point: (p: { x: number; y: number }) => p, angle: (theta: number) => theta };
  const press = (handle: SymmetryHandlePress['handle']): SymmetryHandlePress => ({ handle, group: 'g' });

  it('moves the center by the drag, through the snap', () => {
    const snap = { ...id, point: (p: { x: number; y: number }) => ({ x: Math.round(p.x / 10) * 10, y: p.y }) };
    expect(symmetryHandleChange(press('center'), { center: C, spec: DEFAULT_SYMMETRY }, { x: 0, y: 0 }, { x: 14, y: 3 }, snap))
      .toEqual({ center: { x: 60, y: 53 } });
  });

  it('turns the axis to point at the pointer, through the snap', () => {
    const step = { ...id, angle: (theta: number) => Math.round(theta / (Math.PI / 12)) * (Math.PI / 12) };
    expect(symmetryHandleChange(press('angle'), { center: C, spec: DEFAULT_SYMMETRY }, C, { x: 60, y: 51 }, id).spec!.angle).toBeCloseTo(Math.atan2(1, 10));
    expect(symmetryHandleChange(press('angle'), { center: C, spec: DEFAULT_SYMMETRY }, C, { x: 60, y: 51 }, step).spec!.angle).toBeCloseTo(0);
  });

  it('sets a repeat\'s direction and spacing from its step handle', () => {
    const out = symmetryHandleChange(press('step'), { center: C, spec: DEFAULT_SYMMETRY }, C, { x: 50, y: 90 }, id);
    expect(out.spec!.angle).toBeCloseTo(Math.PI / 2);
    expect(out.spec!.spacing).toBeCloseTo(40);
  });

  it('sets a wallpaper\'s row angle, from its step direction, and row spacing from its row handle', () => {
    const origin = { center: C, spec: spec({ kind: 'wallpaper', angle: 0.25 }) };
    const out = symmetryHandleChange(press('row'), origin, C, { x: 50, y: 90 }, id);
    expect(out.spec!.rowAngle).toBeCloseTo(Math.PI / 2 - 0.25);
    expect(out.spec!.rowSpacing).toBeCloseTo(40);
    expect(out.spec!.angle).toBeUndefined();
  });
});

describe('the wallpaper guide', () => {
  it('dots only the lattice points a capped cell draws at', () => {
    const s = spec({
      kind: 'wallpaper', cell: 'kaleidoscope', count: 6, angle: 0, spacing: 4, rowAngle: Math.PI / 3, rowSpacing: 4,
      extent: { x: -400, y: -400, width: 800, height: 800 },
    });
    const draw = createSymmetryGuideLayer(source(s)).draw!(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS);
    const dots = draw.filter((c) => c.kind === 'path' && 'fill' in c && c.fill && !('stroke' in c && c.stroke));
    expect(dots).toHaveLength(Math.floor(4097 / 12));
  });
});

describe('the guide\'s lines', () => {
  it('cross the canvas from a center far off it', () => {
    // Zoomed 10×, the center 4000 px left of a 400 px canvas, the mirror axis horizontal through it.
    const s = spec({ kind: 'mirror', angle: HORIZONTAL_AXIS });
    const far = { current: () => ({ group: 'g', spec: s, center: { x: -400, y: 20 } }), subscribe: () => () => {} };
    const cmds = createSymmetryGuideLayer(far).draw!(undefined, { x: 0, y: 0, scale: { x: 10, y: 10 } }, DIMS);
    const onCanvas = cmds.filter((c) => {
      if (c.kind !== 'path' || !('stroke' in c) || 'fill' in c) return false;
      const b = boundsOfPath(c.path);
      return b.x <= 0 && b.x + b.width >= 400 && b.y === 200;
    });
    expect(onCanvas).toHaveLength(1);
  });
});

describe('createSymmetryGuideLayer, repeat line', () => {
  it('draws a repeat\'s half-line toward its copies when its spacing is negative', () => {
    const draws = createSymmetryGuideLayer(source(spec({ kind: 'repeat', angle: 0, spacing: -30, count: 3 }))).draw(undefined, VIEW, DIMS);
    const lines = draws.filter((d) => d.kind === 'path' && !('fill' in d && d.fill) && !d.stroke?.dash);
    const half = lines.map((d) => boundsOfPath((d as { path: Parameters<typeof boundsOfPath>[0] }).path)).find((b) => b.height === 0 && b.width > 60)!;
    expect(half.x).toBeCloseTo(0);
    expect(half.x + half.width).toBeCloseTo(100);
  });
});
