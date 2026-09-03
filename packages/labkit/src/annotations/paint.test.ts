import { describe, expect, it } from 'vitest';
import { markCommands } from './paint';
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
    const [cmd] = markCommands(mark('arrow', { points: ENDS }), CONTENT);
    const stroke = (cmd as { stroke?: { markerEnd?: unknown } }).stroke;
    expect(stroke?.markerEnd).toBe('arrow');
    expect(anchors([cmd])).toEqual([0.1 * 200, 0.2 * 100, 0.6 * 200, 0.9 * 100]);
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
});
