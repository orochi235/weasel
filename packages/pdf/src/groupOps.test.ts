import { PATH_L, PATH_M, PATH_Z, type Path } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { describe, expect, it, vi } from 'vitest';
import { composeMatrix, foldColor, foldPixels } from './color';
import { latin1 } from './latin1';
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

describe('composeMatrix', () => {
  it('carries an inner bias through the outer matrix', () => {
    const inner = [1, 0, 0, 0, 0.5, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
    const outer = [2, 0, 0, 0, 0.1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
    const out = composeMatrix(outer, inner);
    expect(out?.[0]).toBe(2);
    expect(out?.[4]).toBeCloseTo(1.1);
    expect(composeMatrix(null, undefined)).toBeNull();
    expect(composeMatrix(null, inner)).toEqual(inner);
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
    expect((rasterize.mock.calls[0] as unknown[])[3]).toBeUndefined();
    expect(box).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toMatchObject({ kind: 'group', children });
    expect(s).toContain('/Subtype /Image');
    expect(content).toMatch(/100 0 0 -100 0 100 cm\n\/Im1 Do\n/);
  });

  it('hands the hook the page view', async () => {
    const rasterize = vi.fn(async () => pixels());
    const view = Float64Array.from([0.75, 0, 0, 0, 0.75, 0, -3, 0, 1]);
    await writePdf(
      [{ width: 100, height: 100, view, commands: [{ kind: 'group', effects: [{ kind: 'blur', radius: 2 } as never], children: [red] }] }],
      { fonts: NO_FONTS, compress: false, rasterize },
    );
    expect((rasterize.mock.calls[0] as unknown[])[3]).toBe(view);
  });

  it('bakes the group transform into the raster commands and places the image under a transformed ancestor', async () => {
    const rasterize = vi.fn(async () => pixels());
    const fx: DrawCommand = { kind: 'group', effects: [{ kind: 'blur', radius: 2 } as never], transform: Float64Array.from([1, 0, 0, 0, 1, 0, 5, 0, 1]), children: [red] };
    const { content } = await render(
      [{ kind: 'group', transform: Float64Array.from([2, 0, 0, 0, 2, 0, 0, 0, 1]), children: [fx] }],
      { rasterize },
    );
    const [cmds] = rasterize.mock.calls[0] as unknown as [{ transform: Float64Array }[]];
    expect([...cmds[0].transform]).toEqual([2, 0, 0, 0, 2, 0, 10, 0, 1]);
    expect(content).toMatch(/q\n0\.5 0 0 0\.5 0 0 cm\n.*\n?q\n100 0 0 -100 0 100 cm\n\/Im1 Do\nQ\nQ/s);
  });

  it('rasterizes shader commands', async () => {
    const rasterize = vi.fn(async () => pixels());
    const shader = { kind: 'shader', program: {}, uniforms: {}, bounds: { x: 10, y: 20, w: 30, h: 40 } } as never;
    const { skipped } = await render([shader], { rasterize });
    expect(skipped).toEqual([]);
    const [cmds, box] = rasterize.mock.calls[0] as unknown as [DrawCommand[], unknown];
    expect(cmds).toEqual([shader]);
    expect(box).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it('draws a composite group as vector source-over and says so', async () => {
    const rasterize = vi.fn(async () => pixels());
    const { skipped, content } = await render(
      [
        { kind: 'group', composite: 'destination-out', children: [red] },
        { kind: 'group', composite: { source: 'one', destination: 'zero' }, children: [red] },
        { kind: 'group', composite: 'source-over', children: [red] },
      ],
      { rasterize },
    );
    expect(rasterize).not.toHaveBeenCalled();
    expect(skipped.map((k) => k.detail)).toEqual([
      'composite destination-out drawn as source-over',
      'composite one/zero drawn as source-over',
    ]);
    expect(content.match(/1 0 0 rg/g)).toHaveLength(3);
  });

  it('rasterizes for effects and still reports the composite', async () => {
    const rasterize = vi.fn(async () => pixels());
    const { skipped } = await render(
      [{ kind: 'group', composite: 'xor', effects: [{ kind: 'blur', radius: 2 } as never], children: [red] }],
      { rasterize },
    );
    expect(rasterize).toHaveBeenCalledTimes(1);
    expect(skipped.map((k) => k.detail)).toEqual(['composite xor drawn as source-over']);
  });

  it('skips a failed or malformed raster instead of failing the document', async () => {
    const fx: DrawCommand = { kind: 'group', effects: [{ kind: 'blur', radius: 2 } as never], children: [red] };
    const failed = await render([fx], { rasterize: async () => Promise.reject(new Error('no gl')) });
    expect(failed.skipped.map((k) => k.detail)).toEqual(['effects raster failed: no gl']);
    const short = await render([fx], {
      rasterize: async () => ({ width: 2, height: 2, data: new Uint8ClampedArray(4) }),
    });
    expect(short.skipped.map((k) => k.detail)).toEqual(['effects raster has the wrong number of pixels']);
    expect(short.s).not.toContain('/Subtype /Image');
  });

  it('reports the alpha offset an isolated group cannot carry', async () => {
    const bias = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0.2];
    const { skipped } = await render([{ kind: 'group', isolate: true, colorMatrix: bias, children: [red] }]);
    expect(skipped.map((k) => k.detail)).toEqual(['group color matrix alpha offset is not drawn']);
  });

  it('skips and reports what needs a raster when no hook is given', async () => {
    const { skipped, content } = await render([
      { kind: 'group', effects: [{ kind: 'blur', radius: 2 } as never], children: [red] },
      { kind: 'shader', program: {}, uniforms: {}, bounds: { x: 0, y: 0, w: 5, h: 5 } } as never,
    ]);
    expect(skipped.map((k) => k.kind)).toEqual(['command', 'command']);
    expect(skipped[0].detail).toMatch(/effects/);
    expect(skipped[1].detail).toMatch(/shader/);
    expect(content).not.toContain('rg');
  });

  it('clips through the fill, leaving out open contours under openFill none', async () => {
    const mixed: Path = {
      kind: 'polygon',
      commands: Uint8Array.from([PATH_M, PATH_L, PATH_L, PATH_Z, PATH_M, PATH_L, PATH_L]),
      coords: Float32Array.from([0, 0, 10, 0, 10, 10, 20, 20, 30, 20, 30, 30]),
      fillRule: 'nonzero',
      openFill: 'none',
    };
    const { content } = await render([{ kind: 'group', clip: mixed, children: [red] }]);
    const clip = content.slice(0, content.indexOf('W\nn\n'));
    expect(clip).toContain('0 0 m');
    expect(clip).not.toContain('20 20 m');
  });
});
