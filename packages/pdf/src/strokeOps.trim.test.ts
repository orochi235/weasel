import { pathFromD, type Path } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { describe, expect, it } from 'vitest';
import { latin1 } from './latin1';
import { NO_FONTS } from './testing/noFonts';
import { writePdf } from './writePdf';

const ink = { color: '#000000' };
const line = pathFromD('M0 0 L50 0');

async function content(commands: DrawCommand[]): Promise<string> {
  const { bytes } = await writePdf([{ width: 100, height: 100, commands }], { fonts: NO_FONTS, compress: false });
  const s = latin1(bytes);
  return s.slice(s.indexOf('stream\n') + 7, s.indexOf('\nendstream'));
}
const stroked = (path: Path, stroke: object, fill?: object): DrawCommand =>
  ({ kind: 'path', path, stroke: { paint: ink, width: 1, ...stroke }, ...(fill ? { fill } : {}) }) as DrawCommand;

describe('writeStroke under a trim', () => {
  it('strokes the cut path natively, its dash starting at the cut', async () => {
    const c = await content([stroked(line, { dash: [4, 2], trim: { start: 0.2 } })]);
    expect(c).toContain('[4 2] 4 d\n10 0 m\n50 0 l\nS\n');
  });

  it('writes nothing of a stroke whose window is empty', async () => {
    const c = await content([stroked(line, { trim: { start: 0.5, end: 0.5 } })]);
    expect(c).not.toMatch(/\nS\n/);
  });

  it('fill keeps the whole outline under a trim', async () => {
    const square = pathFromD('M0 0 L100 0 L100 100 L0 100 Z');
    const c = await content([stroked(square, { trim: { end: 0.5 } }, { paint: { color: '#ff0000' } })]);
    expect(c).toContain('0 0 m\n100 0 l\n100 100 l\n0 100 l\nh\n');
    expect(c).toContain('0 0 m\n100 0 l\n100 100 l\nS\n');
  });

  it('restarts the pattern for a run after one cut mid-pattern', async () => {
    const c = await content([stroked(pathFromD('M0 0 L10 0 M20 0 L30 0'), { dash: [2, 2], trim: { start: 0.25 } })]);
    expect(c).toContain('[2 2] 1 d\n5 0 m\n10 0 l\nS\n');
    expect(c).toContain('[2 2] 0 d\n20 0 m\n30 0 l\nS\n');
  });

  it('cuts each command by its own trim, as a derived node paints its parts', async () => {
    const c = await content([stroked(line, { trim: { end: 0.5 } }), stroked(pathFromD('M0 10 L50 10'), { trim: { start: 0.5 } })]);
    expect(c).toContain('0 0 m\n25 0 l\nS\n');
    expect(c).toContain('25 10 m\n50 10 l\nS\n');
  });

  it('decides a dash too fine to draw on the whole path, not the visible span', async () => {
    const c = await content([stroked(line, { dash: [0.0004, 0.0004], trim: { end: 0.5 } })]);
    expect(c).not.toMatch(/ d\n/);
    expect(c).toContain('0 0 m\n25 0 l\nS\n');
  });

  it('cuts the outline of a stroke PDF cannot draw natively', async () => {
    const c = await content([stroked(line, { width: 4, vertexWidths: [2, 6], trim: { end: 0.5 } })]);
    const xs = [...c.matchAll(/(-?[\d.]+) (-?[\d.]+) [ml]\n/g)].map((m) => Number(m[1]));
    expect(Math.max(...xs)).toBeCloseTo(25, 3);
  });
});
