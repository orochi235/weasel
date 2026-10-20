import type { Path } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { describe, expect, it, vi } from 'vitest';
import { foldColor, foldPixels } from './color';
import { latin1 } from './testing/latin1';
import { NO_FONTS } from './testing/noFonts';
import { type RasterPixels, type WritePdfOptions, writePdf } from './writePdf';

const rect: Path = { kind: 'rect', x: 10, y: 20, width: 30, height: 40 };
const red: DrawCommand = { kind: 'path', path: rect, fill: { paint: { color: '#ff0000' } } };
const GRAY = [0.3, 0.3, 0.3, 0, 0, 0.3, 0.3, 0.3, 0, 0, 0.3, 0.3, 0.3, 0, 0, 0, 0, 0, 1, 0];

async function render(commands: DrawCommand[], opts: Partial<WritePdfOptions> = {}) {
  const { bytes, skipped } = await writePdf([{ width: 100, height: 100, commands }], {
    fonts: NO_FONTS,
    compress: false,
    ...opts,
  });
  const s = latin1(bytes);
  const content = s.slice(s.indexOf('stream\n') + 7, s.indexOf('\nendstream'));
  return { s, content, skipped };
}

const pixels = (): RasterPixels => ({ width: 2, height: 2, data: new Uint8ClampedArray(16).fill(255) });

describe('foldColor', () => {
  it('maps straight rgba through a 4x5 matrix and clamps', () => {
    expect(foldColor([1, 0, 0, 1], GRAY)).toEqual([0.3, 0.3, 0.3, 1]);
    expect(foldColor([1, 1, 1, 0.5], [2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0.25])).toEqual([1, 1, 1, 0.75]);
    expect(foldColor([0.2, 0.4, 0.6, 1], null)).toEqual([0.2, 0.4, 0.6, 1]);
  });
});

describe('foldPixels', () => {
  it('applies the state matrix to straight pixels and leaves identity untouched', () => {
    const data = Uint8ClampedArray.from([255, 0, 0, 255]);
    const state = { transform: new Float64Array(9), alpha: 1, colorMatrix: GRAY };
    expect([...foldPixels(data, state)]).toEqual([76, 76, 76, 255]);
    expect(foldPixels(data, { ...state, colorMatrix: null })).toBe(data);
  });
});

describe('writeGroup', () => {
  it('folds an accumulated color matrix into solid colors', async () => {
    const { content } = await render([
      { kind: 'group', colorMatrix: GRAY, children: [red] },
      {
        kind: 'group',
        colorMatrix: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
        children: [{ kind: 'group', colorMatrix: GRAY, children: [red] }],
      },
    ]);
    expect(content).toContain('0.3 0.3 0.3 rg\n');
    expect(content).toContain('0 0.3 0.3 rg\n');
  });

  it('draws an isolated group as a transparency group form', async () => {
    const { s, content } = await render([
      { kind: 'group', isolate: true, alpha: 0.5, children: [red, red] },
    ]);
    expect(s).toContain('/Subtype /Form');
    expect(s).toMatch(/\/Group <<\/Type \/Group \/S \/Transparency \/I true/);
    expect(content).toMatch(/\/GS1 gs\n\/Im1 Do\n/);
    expect(s).toContain('/ca 0.5');
    expect(content).not.toContain('rg');
    expect(s).toContain('1 0 0 rg');
  });

  it('rasterizes a group with effects through the hook and places the image', async () => {
    const rasterize = vi.fn(async () => pixels());
    const children = [red];
    const { s, content, skipped } = await render(
      [{ kind: 'group', effects: [{ kind: 'blur', radius: 2 } as never], transform: Float64Array.from([1, 0, 0, 0, 1, 0, 5, 0, 1]), children }],
      { rasterize },
    );
    expect(skipped).toEqual([]);
    expect(rasterize).toHaveBeenCalledTimes(1);
    const [cmds, box, scale] = rasterize.mock.calls[0] as unknown as [DrawCommand[], { x: number; y: number; width: number; height: number }, number];
    expect(scale).toBe(2);
    expect(box).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toMatchObject({ kind: 'group', children });
    expect(s).toContain('/Subtype /Image');
    expect(content).toMatch(/100 0 0 -100 0 100 cm\n\/Im1 Do\n/);
  });

  it('rasterizes shader commands and non-source-over composites', async () => {
    const rasterize = vi.fn(async () => pixels());
    const shader = { kind: 'shader', program: {}, uniforms: {}, bounds: { x: 10, y: 20, w: 30, h: 40 } } as never;
    const { skipped } = await render(
      [shader, { kind: 'group', composite: 'source-in', children: [red] }, { kind: 'group', composite: 'source-over', children: [red] }],
      { rasterize },
    );
    expect(skipped).toEqual([]);
    expect(rasterize).toHaveBeenCalledTimes(2);
    const [cmds, box] = rasterize.mock.calls[0] as unknown as [DrawCommand[], unknown];
    expect(cmds).toEqual([shader]);
    expect(box).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it('skips and reports what needs a raster when no hook is given', async () => {
    const { skipped, content } = await render([
      { kind: 'group', effects: [{ kind: 'blur', radius: 2 } as never], children: [red] },
      { kind: 'group', composite: 'xor', children: [red] },
      { kind: 'shader', program: {}, uniforms: {}, bounds: { x: 0, y: 0, w: 5, h: 5 } } as never,
    ]);
    expect(skipped.map((k) => k.kind)).toEqual(['command', 'command', 'command']);
    expect(skipped[0].detail).toMatch(/effects/);
    expect(skipped[1].detail).toBe('composite xor');
    expect(skipped[2].detail).toMatch(/shader/);
    expect(content).not.toContain('rg');
  });
});
