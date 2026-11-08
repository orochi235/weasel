import { PATH_L, PATH_M, type Path } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { describe, expect, it } from 'vitest';
import { latin1 } from './latin1';
import { NO_FONTS } from './testing/noFonts';
import { writePdf } from './writePdf';

const line: Path = {
  kind: 'polygon',
  commands: Uint8Array.from([PATH_M, PATH_L]),
  coords: Float32Array.from([0, 0, 50, 0]),
  fillRule: 'nonzero',
};
const ink = { color: '#000000' };

async function content(commands: DrawCommand[]): Promise<string> {
  return (await render(commands)).content;
}

async function render(commands: DrawCommand[]) {
  const { bytes, skipped } = await writePdf([{ width: 100, height: 100, commands }], {
    fonts: NO_FONTS,
    compress: false,
  });
  const s = latin1(bytes);
  return { content: s.slice(s.indexOf('stream\n') + 7, s.indexOf('\nendstream')), skipped };
}

describe('writeStroke', () => {
  it('strokes a plain centered stroke natively', async () => {
    const c = await content([
      {
        kind: 'path',
        path: line,
        stroke: {
          paint: ink,
          width: 3,
          cap: 'round',
          join: 'bevel',
          dash: [4, 2],
        },
      },
    ]);
    expect(c).toContain('3 w\n');
    expect(c).toContain('1 J\n');
    expect(c).toContain('2 j\n');
    expect(c).toContain('4 M\n');
    expect(c).toContain('[4 2] 0 d\n');
    expect(c).toMatch(/\nS\n/);
  });

  it('writes the default caps and joins as butt and miter, with a miter limit when given', async () => {
    const c = await content([
      {
        kind: 'path',
        path: line,
        stroke: { paint: ink, width: 1, miterLimit: 10 },
      },
    ]);
    expect(c).toContain('0 J\n');
    expect(c).toContain('0 j\n');
    expect(c).toContain('10 M\n');
  });

  it('resolves a { px } width against the accumulated scale', async () => {
    const c = await content([
      {
        kind: 'group',
        transform: Float64Array.from([0.75, 0, 0, 0, 0.75, 0, 0, 0, 1]),
        children: [
          {
            kind: 'path',
            path: line,
            stroke: { paint: ink, width: { px: 2 }, dash: [3, 3] },
          },
        ],
      },
    ]);
    expect(c).toContain('2.6667 w\n');
    expect(c).toContain('[4 4] 0 d\n');
  });

  it('fills the outline of a stroke PDF cannot draw', async () => {
    const square: Path = { kind: 'rect', x: 10, y: 10, width: 40, height: 40 };
    for (const [path, stroke] of [
      [square, { paint: ink, width: 4, align: 'inner' as const }],
      [line, { paint: ink, width: 4, vertexWidths: [1, 3] }],
      [line, { paint: ink, width: 4, nib: { angle: 0, ratio: 0.5 } }],
    ] as const) {
      const c = await content([{ kind: 'path', path, stroke }]);
      expect(c, JSON.stringify(stroke)).not.toMatch(/\nS\n/);
      expect(c, JSON.stringify(stroke)).toContain('0 0 0 rg\n');
      expect(c, JSON.stringify(stroke)).toMatch(/\nf\n/);
    }
  });

  it('writes nothing for an inner stroke of an open line, whose outline is empty', async () => {
    const c = await content([{ kind: 'path', path: line, stroke: { paint: ink, width: 4, align: 'inner' } }]);
    expect(c).not.toMatch(/\n[fS]\n/);
  });

  it('reports vertexColors as approximated by the single paint', async () => {
    const { content: c, skipped } = await render([
      { kind: 'path', path: line, stroke: { paint: ink, width: 4, vertexColors: [1, 0, 0, 1, 0, 0, 1, 1] } },
    ]);
    expect(c).toMatch(/\nf\n/);
    expect(skipped.map((k) => k.detail)).toEqual(['stroke vertexColors approximated by a single paint']);
  });

  it('writes nothing for a zero-width stroke', async () => {
    const c = await content([{ kind: 'path', path: line, stroke: { paint: ink, width: 0 } }]);
    expect(c).not.toContain(' w\n');
    expect(c).not.toMatch(/\nS\n/);
  });

  it('resolves a { px } marker size against the accumulated scale', async () => {
    const inGroup = (size: number | { px: number }): DrawCommand => ({
      kind: 'group',
      transform: Float64Array.from([0.75, 0, 0, 0, 0.75, 0, 0, 0, 1]),
      children: [{ kind: 'path', path: line, stroke: { paint: ink, width: 2, markerEnd: { key: 'arrow', size } } }],
    });
    expect(await content([inGroup({ px: 12 })])).toBe(await content([inGroup(16)]));
  });

  it('draws a gradient stroke as a shaded outline', async () => {
    const c = await content([
      {
        kind: 'path',
        path: line,
        stroke: {
          paint: {
            kind: 'linear-gradient',
            from: { x: 0, y: 0 },
            to: { x: 50, y: 0 },
            stops: [
              { offset: 0, color: '#ff0000' },
              { offset: 1, color: '#0000ff' },
            ],
            units: 'local',
          },
          width: 4,
        },
      },
    ]);
    expect(c).toContain('W\nn\n');
    expect(c).toMatch(/\/\w+ sh\n/);
    expect(c).not.toMatch(/\nS\n/);
  });

  it('draws marker heads as their own commands', async () => {
    const plain = await content([{ kind: 'path', path: line, stroke: { paint: ink, width: 2 } }]);
    const marked = await content([
      {
        kind: 'path',
        path: line,
        stroke: { paint: ink, width: 2, markerEnd: 'arrow' },
      },
    ]);
    const fills = (s: string) => s.match(/\nf\n/g)?.length ?? 0;
    expect(fills(plain)).toBe(0);
    expect(fills(marked)).toBe(1);
  });

  it('strokes a headed line natively, stopped short of the head by its inset', async () => {
    const c = await content([{ kind: 'path', path: line, stroke: { paint: ink, width: 2, markerEnd: 'arrow' } }]);
    expect(c).toMatch(/\n0 0 m\n44 0 l\nS\n/);
  });

  it('writes dash lengths as PDF numbers and an all-zero dash as solid', async () => {
    const stroked = (dash: number[]) => content([{ kind: 'path', path: line, stroke: { paint: ink, width: 1, dash } }]);
    expect(await stroked([1 / 3, 2])).toContain('[0.3333 2] 0 d\n');
    expect(await stroked([0, 0])).not.toMatch(/ d\n/);
    expect(await stroked([5, -1])).not.toMatch(/ d\n/);
    expect(await stroked([1e-9, 1e-9])).not.toMatch(/ d\n/);
  });

  it('draws no stroke for a dash with a non-finite entry, as the renderer draws none, and keeps the fill', async () => {
    const square = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    const { content: c, skipped } = await render([
      { kind: 'path', path: square, fill: { paint: ink }, stroke: { paint: ink, width: 1, dash: [4, NaN] } },
    ]);
    expect(c).not.toMatch(/\nS\n/);
    expect(c).toMatch(/\nf\n/);
    expect(skipped).toEqual([]);
  });

  it('writes a dash offset as the phase, wrapped into one cycle as the renderer reads it', async () => {
    const stroked = (dashOffset: number, dash = [4, 2]) =>
      content([{ kind: 'path', path: line, stroke: { paint: ink, width: 1, dash, dashOffset } }]);
    expect(await stroked(1.5)).toContain('[4 2] 1.5 d\n');
    expect(await stroked(-1)).toContain('[4 2] 5 d\n');
    expect(await stroked(13)).toContain('[4 2] 1 d\n');
    expect(await stroked(7, [3])).toContain('[3] 1 d\n');
    expect(await stroked(NaN)).toContain('[4 2] 0 d\n');
  });

  it('still draws the heads of a stroke whose dash draws no line, as the renderer does', async () => {
    const { content: c } = await render([
      { kind: 'path', path: line, stroke: { paint: ink, width: 1, dash: [4, NaN], markerEnd: 'arrow' } },
    ]);
    expect(c).not.toMatch(/\nS\n/);
    expect(c).toMatch(/\nf\n/);
  });
});
