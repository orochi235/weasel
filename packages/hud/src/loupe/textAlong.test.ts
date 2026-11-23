import { describe, expect, it } from 'vitest';
import type { DrawCommand, GroupDrawCommand, TextDrawCommand } from '@weasel-js/core/renderer';
import { ellipseShape, lineShape } from '@weasel-js/geom';
import { runAlong, textAlong, textAt } from './textAlong';

const turnOf = (c: DrawCommand): number => {
  const m = (c as GroupDrawCommand).transform!;
  return Math.atan2(m[1]!, m[0]!);
};
const t = { text: 'Pixel', fontFamily: 'D', fontSize: 10, color: '#000' };

describe('textAlong', () => {
  it('sets one turned character per letter, upright on a track running right', () => {
    const cmds = textAlong(lineShape({ x: 0, y: 0 }, { x: 100, y: 0 }), 0.5, t);
    expect(cmds).toHaveLength(5);
    for (const c of cmds) expect(turnOf(c)).toBeCloseTo(0);
  });

  it('turns each letter to the arc’s heading where it stands', () => {
    // Across the bottom of a circle, counterclockwise: left to right, bending up at either end.
    const arc = ellipseShape({ center: { x: 0, y: 0 }, radiusX: 40, radiusY: 40, start: 225, end: 135, direction: 'ccw' });
    const turns = textAlong(arc, 0.5, { ...t, text: 'Vector words' }).map(turnOf);
    expect(turns[0]!).toBeGreaterThan(turns.at(-1)!);
  });

  it('reads against a track running left, so the text stays upright', () => {
    const left = lineShape({ x: 100, y: 0 }, { x: 0, y: 0 });
    expect(runAlong(left, 0.5, 20).flip).toBe(true);
    for (const c of textAlong(left, 0.5, t)) expect(Math.abs(turnOf(c))).toBeCloseTo(0);
  });

  it('stands a short label in one piece, turned to the heading at its stop, halo first', () => {
    const arc = ellipseShape({ center: { x: 0, y: 0 }, radiusX: 40, radiusY: 40, start: 225, end: 135, direction: 'ccw' });
    const cmds = textAt(arc, 0, { ...t, text: '64×', halo: '#fff' });
    expect(cmds).toHaveLength(2);
    expect((cmds[0] as GroupDrawCommand).children).toHaveLength(8);
    expect(turnOf(cmds[1]!)).toBeCloseTo(turnOf(cmds[0]!));
    expect(turnOf(cmds[1]!)).toBeGreaterThan(0.5);
  });

  it('sets a scaled run larger, after the rest, centered on the same line', () => {
    const line = lineShape({ x: 0, y: 0 }, { x: 100, y: 0 });
    const [g] = textAt(line, 0.5, { ...t, text: [{ text: '64' }, { text: '×', scale: 1.4 }] });
    const [digits, times] = (g as GroupDrawCommand).children as TextDrawCommand[];
    expect(times!.style.fontSize).toBeCloseTo(14);
    expect(times!.x).toBeGreaterThan(digits!.x);
    expect(times!.y + times!.height! / 2).toBeCloseTo(digits!.y + digits!.height! / 2);
  });
});
