import { registerNodeShape, type SceneNode, shapeCoversPoint } from '@weasel-js/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorldRect } from './frac';
import { markCommands, POINT_MARK_SHAPE } from './paint';
import type { AnnotationData, AnnotationKind, FracPoint } from './types';

const POSE = { x: 20, y: 10, width: 60, height: 40 };
const AT_50: WorldRect = { x: 50, y: 50, width: 0, height: 0 };

function mark(kind: AnnotationKind, extra: Partial<AnnotationData> = {}) {
  return { pose: POSE, data: { target: 't', kind, ...extra } as AnnotationData };
}

/** Every point of the first command's path, in world units. */
function anchors(cmds: ReturnType<typeof markCommands>): number[] {
  const cmd = cmds[0];
  if (cmd?.kind !== 'path') throw new Error('expected a path command');
  const p = cmd.path as { kind: string; coords?: Float32Array };
  return p.coords ? [...p.coords] : [];
}

/** In fractions of `POSE`: (35, 10) and (80, 30) in world. */
const ENDS: readonly FracPoint[] = [
  { x: 0.25, y: 0 },
  { x: 1, y: 0.5 },
];

describe('markCommands', () => {
  it('draws a rect at the pose', () => {
    const [cmd] = markCommands(mark('rect'));
    expect(cmd).toMatchObject({ kind: 'path', path: { kind: 'rect', ...POSE } });
    expect((cmd as { fill?: unknown }).fill).toBeUndefined();
  });

  it('draws an ellipse inscribed in the pose', () => {
    const pts = anchors(markCommands(mark('ellipse')));
    const xs = pts.filter((_, i) => i % 2 === 0);
    const ys = pts.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBeCloseTo(POSE.x, 4);
    expect(Math.max(...xs)).toBeCloseTo(POSE.x + POSE.width, 4);
    expect(Math.min(...ys)).toBeCloseTo(POSE.y, 4);
    expect(Math.max(...ys)).toBeCloseTo(POSE.y + POSE.height, 4);
  });

  it('runs a line between its two stored ends, placed in the pose', () => {
    expect(anchors(markCommands(mark('line', { shape: ENDS })))).toEqual([35, 10, 80, 30]);
  });

  it('makes an arrow the same line, carrying an end marker', () => {
    const cmds = markCommands(mark('arrow', { shape: ENDS }));
    expect(cmds).toHaveLength(1);
    const stroke = (cmds[0] as { stroke?: { markerEnd?: unknown } }).stroke;
    expect(stroke?.markerEnd).toBe('arrow');
    expect(anchors(cmds)).toEqual([35, 10, 80, 30]);
  });

  it('threads a freehand stroke through every point', () => {
    const pts: FracPoint[] = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 0 },
    ];
    expect(anchors(markCommands(mark('stroke', { shape: pts })))).toEqual([20, 10, 50, 30, 80, 10]);
  });

  it('falls back to the pose diagonal when a vertex kind has no shape', () => {
    // A stored mark from a writer that dropped `shape` must still draw
    // something at the right place, not vanish.
    expect(anchors(markCommands(mark('line')))).toEqual([
      POSE.x,
      POSE.y,
      POSE.x + POSE.width,
      POSE.y + POSE.height,
    ]);
  });

  it('draws text at the pose, carrying the title', () => {
    const [cmd] = markCommands(mark('text', { title: 'missing edge' }));
    expect(cmd).toMatchObject({ kind: 'text', x: POSE.x, y: POSE.y });
    const runs = (cmd as { runs: { text: string }[] }).runs;
    expect(runs.map((r) => r.text).join('')).toBe('missing edge');
  });

  it('draws an untitled text mark as nothing rather than an empty run', () => {
    expect(markCommands(mark('text'))).toEqual([]);
  });

  it('draws a point as a small unfilled ring centered on its position', () => {
    const cmds = markCommands({ pose: AT_50, data: { target: 't', kind: 'point' } });
    expect(cmds).toHaveLength(1);
    expect((cmds[0] as { fill?: unknown }).fill).toBeUndefined();
    const pts = anchors(cmds);
    const xs = pts.filter((_, i) => i % 2 === 0);
    const ys = pts.filter((_, i) => i % 2 === 1);
    // Centered on (50, 50) in world, radius 4.
    expect(Math.min(...xs)).toBeCloseTo(46, 4);
    expect(Math.max(...xs)).toBeCloseTo(54, 4);
    expect(Math.min(...ys)).toBeCloseTo(46, 4);
    expect(Math.max(...ys)).toBeCloseTo(54, 4);
  });
});

describe('a point mark at different zooms', () => {
  const POINT = { pose: AT_50, data: { target: 't', kind: 'point' } as AnnotationData };
  const radiusAt = (zoom: number) => {
    const xs = anchors(markCommands(POINT, {}, { x: zoom, y: zoom })).filter((_, i) => i % 2 === 0);
    return (Math.max(...xs) - Math.min(...xs)) / 2;
  };

  it('sizes the ring in screen pixels, so its world radius scales inversely with zoom', () => {
    expect(radiusAt(2)).toBeCloseTo(2, 4);
    expect(radiusAt(4)).toBeCloseTo(1, 4);
  });

  it('keeps the ring round on screen under a non-uniform scale', () => {
    const pts = anchors(markCommands(POINT, {}, { x: 2, y: 4 }));
    const xs = pts.filter((_, i) => i % 2 === 0);
    const ys = pts.filter((_, i) => i % 2 === 1);
    expect((Math.max(...xs) - Math.min(...xs)) * 2).toBeCloseTo(
      (Math.max(...ys) - Math.min(...ys)) * 4,
      4,
    );
  });
});

describe('picking a point mark', () => {
  let dispose: () => void = () => {};
  beforeEach(() => {
    dispose = registerNodeShape(POINT_MARK_SHAPE, { priority: 'high' });
  });
  afterEach(() => dispose());

  const pose: WorldRect = { x: 50, y: 50, width: 0, height: 0 };
  const node = {
    id: 'p',
    kind: 'leaf',
    layer: 'marks',
    pose,
    data: { target: 't', kind: 'point' },
  } as unknown as SceneNode<AnnotationData, 'marks', WorldRect>;

  // Ring radius 4px plus half the 2px outline: the ring's outer edge is 5px out.
  it.each([1, 4])('reaches the ring it draws and no further, at zoom %i', (zoom) => {
    const at = (px: number) => shapeCoversPoint(node, pose, 50 + px / zoom, 50, { scale: zoom });
    expect(at(4.9)).toBe(true);
    expect(at(5.5)).toBe(false);
  });
});

describe('markCommands styling', () => {
  it('takes a status color over the default', () => {
    const [cmd] = markCommands(mark('rect'), { color: '#30a46c' });
    expect((cmd as { stroke?: { paint?: { color?: string } } }).stroke?.paint?.color).toBe(
      '#30a46c',
    );
  });

  it('dashes a stale mark rather than hiding it', () => {
    // A stale mark still describes something; dropping it would lose it.
    const [fresh] = markCommands(mark('rect'));
    const [stale] = markCommands(mark('rect'), { stale: true });
    expect((fresh as { stroke?: { dash?: number[] } }).stroke?.dash).toBeUndefined();
    expect((stale as { stroke?: { dash?: number[] } }).stroke?.dash).toEqual([6, 4]);
  });

  it('dashes a stale point ring like any other mark', () => {
    const [ring] = markCommands(mark('point'), { stale: true });
    expect((ring as { stroke?: { dash?: number[] } }).stroke?.dash).toEqual([6, 4]);
  });

  it("colors a text mark's glyphs too, not only the outlines", () => {
    const [cmd] = markCommands(mark('text', { title: 'x' }), { color: '#30a46c' });
    const runs = (cmd as { runs: { fill?: { color?: string } }[] }).runs;
    expect(runs[0]?.fill?.color).toBe('#30a46c');
  });
});
