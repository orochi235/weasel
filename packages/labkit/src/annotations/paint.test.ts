import { registerNodeShape, type SceneNode, shapeCoversPoint } from '@weasel-js/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorldRect } from './frac';
import { markCommands, POINT_MARK_SHAPE } from './paint';
import type { AnnotationData, AnnotationKind, FracPoint } from './types';

const CONTENT = { w: 200, h: 100 };
const POSE = { x: 20, y: 10, width: 60, height: 40 };

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

const ENDS: readonly FracPoint[] = [
  { x: 0.1, y: 0.2 },
  { x: 0.6, y: 0.9 },
];

describe('markCommands', () => {
  it('draws a rect at the pose', () => {
    const [cmd] = markCommands(mark('rect'), CONTENT);
    expect(cmd).toMatchObject({ kind: 'path', path: { kind: 'rect', ...POSE } });
    expect((cmd as { fill?: unknown }).fill).toBeUndefined();
  });

  it('draws an ellipse inscribed in the pose', () => {
    const pts = anchors(markCommands(mark('ellipse'), CONTENT));
    const xs = pts.filter((_, i) => i % 2 === 0);
    const ys = pts.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBeCloseTo(POSE.x, 4);
    expect(Math.max(...xs)).toBeCloseTo(POSE.x + POSE.width, 4);
    expect(Math.min(...ys)).toBeCloseTo(POSE.y, 4);
    expect(Math.max(...ys)).toBeCloseTo(POSE.y + POSE.height, 4);
  });

  it('runs a line between its two stored ends, converted to world', () => {
    expect(anchors(markCommands(mark('line', { points: ENDS }), CONTENT))).toEqual([
      0.1 * 200,
      0.2 * 100,
      0.6 * 200,
      0.9 * 100,
    ]);
  });

  it('makes an arrow the same line, carrying an end marker', () => {
    const cmds = markCommands(mark('arrow', { points: ENDS }), CONTENT);
    expect(cmds).toHaveLength(1);
    const stroke = (cmds[0] as { stroke?: { markerEnd?: unknown } }).stroke;
    expect(stroke?.markerEnd).toBe('arrow');
    expect(anchors(cmds)).toEqual([0.1 * 200, 0.2 * 100, 0.6 * 200, 0.9 * 100]);
  });

  it('threads a freehand stroke through every point', () => {
    const pts: FracPoint[] = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 0 },
    ];
    expect(anchors(markCommands(mark('stroke', { points: pts }), CONTENT))).toEqual([
      0, 0, 100, 50, 200, 0,
    ]);
  });

  it('falls back to the pose diagonal when a points kind has no points', () => {
    // A stored mark from a writer that dropped `points` must still draw
    // something at the right place, not vanish.
    expect(anchors(markCommands(mark('line'), CONTENT))).toEqual([
      POSE.x,
      POSE.y,
      POSE.x + POSE.width,
      POSE.y + POSE.height,
    ]);
  });

  it('draws text at the pose, carrying the title', () => {
    const [cmd] = markCommands(mark('text', { title: 'missing edge' }), CONTENT);
    expect(cmd).toMatchObject({ kind: 'text', x: POSE.x, y: POSE.y });
    const runs = (cmd as { runs: { text: string }[] }).runs;
    expect(runs.map((r) => r.text).join('')).toBe('missing edge');
  });

  it('draws an untitled text mark as nothing rather than an empty run', () => {
    expect(markCommands(mark('text'), CONTENT)).toEqual([]);
  });

  it('draws a point as a small unfilled ring centered on its one stored point', () => {
    const cmds = markCommands(mark('point', { points: [{ x: 0.25, y: 0.5 }] }), CONTENT);
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
  const POINT = mark('point', { points: [{ x: 0.25, y: 0.5 }] });
  const radiusAt = (zoom: number) => {
    const xs = anchors(markCommands(POINT, CONTENT, {}, { x: zoom, y: zoom })).filter(
      (_, i) => i % 2 === 0,
    );
    return (Math.max(...xs) - Math.min(...xs)) / 2;
  };

  it('sizes the ring in screen pixels, so its world radius scales inversely with zoom', () => {
    expect(radiusAt(2)).toBeCloseTo(2, 4);
    expect(radiusAt(4)).toBeCloseTo(1, 4);
  });

  it('keeps the ring round on screen under a non-uniform scale', () => {
    const pts = anchors(markCommands(POINT, CONTENT, {}, { x: 2, y: 4 }));
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
    data: { target: 't', kind: 'point', points: [{ x: 0.25, y: 0.5 }] },
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
    const [cmd] = markCommands(mark('rect'), CONTENT, { color: '#30a46c' });
    expect((cmd as { stroke?: { paint?: { color?: string } } }).stroke?.paint?.color).toBe(
      '#30a46c',
    );
  });

  it('dashes a stale mark rather than hiding it', () => {
    // A stale mark still describes something; dropping it would lose it.
    const [fresh] = markCommands(mark('rect'), CONTENT);
    const [stale] = markCommands(mark('rect'), CONTENT, { stale: true });
    expect((fresh as { stroke?: { dash?: number[] } }).stroke?.dash).toBeUndefined();
    expect((stale as { stroke?: { dash?: number[] } }).stroke?.dash).toEqual([6, 4]);
  });

  it('dashes a stale point ring like any other mark', () => {
    const [ring] = markCommands(mark('point', { points: [{ x: 0.25, y: 0.5 }] }), CONTENT, {
      stale: true,
    });
    expect((ring as { stroke?: { dash?: number[] } }).stroke?.dash).toEqual([6, 4]);
  });

  it("colors a text mark's glyphs too, not only the outlines", () => {
    const [cmd] = markCommands(mark('text', { title: 'x' }), CONTENT, { color: '#30a46c' });
    const runs = (cmd as { runs: { fill?: { color?: string } }[] }).runs;
    expect(runs[0]?.fill?.color).toBe('#30a46c');
  });
});
