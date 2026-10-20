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
    for (const stroke of [
      { paint: ink, width: 4, align: 'inner' as const },
      { paint: ink, width: 4, vertexWidths: [1, 3] },
      { paint: ink, width: 4, nib: { angle: 0, ratio: 0.5 } },
    ]) {
      const c = await content([{ kind: 'path', path: line, stroke }]);
      expect(c, JSON.stringify(stroke)).not.toMatch(/\nS\n/);
      expect(c, JSON.stringify(stroke)).toContain('0 0 0 rg\n');
      expect(c, JSON.stringify(stroke)).toMatch(/\nf\n/);
    }
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

  it('writes dash lengths as PDF numbers and an all-zero dash as solid', async () => {
    const stroked = (dash: number[]) => content([{ kind: 'path', path: line, stroke: { paint: ink, width: 1, dash } }]);
    expect(await stroked([1 / 3, 2])).toContain('[0.3333 2] 0 d\n');
    expect(await stroked([0, 0])).not.toMatch(/ d\n/);
  });
});
