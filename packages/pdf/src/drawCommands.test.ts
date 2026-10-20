import type { Path } from '@weasel-js/geom';
import { PATH_L, PATH_M, PATH_Z } from '@weasel-js/geom';
import { type DrawCommand, registerPaintDrawKind } from '@weasel-js/renderer';
import { describe, expect, it, vi } from 'vitest';
import { latin1 } from './latin1';
import { NO_FONTS } from './testing/noFonts';
import { type WritePdfOptions, writePdf } from './writePdf';

const rect: Path = { kind: 'rect', x: 0, y: 0, width: 10, height: 20 };

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

const mixed: Path = {
  kind: 'polygon',
  commands: Uint8Array.from([PATH_M, PATH_L, PATH_L, PATH_Z, PATH_M, PATH_L, PATH_L]),
  coords: Float32Array.from([0, 0, 10, 0, 10, 10, 20, 20, 30, 20, 30, 30]),
  fillRule: 'nonzero',
  openFill: 'none',
};

describe('writeCommands', () => {
  it('fills only closed contours when openFill is none', async () => {
    const { content } = await render([
      { kind: 'path', path: mixed, fill: { paint: { color: '#000' } }, stroke: { paint: { color: '#000' }, width: 1 } },
    ]);
    const fill = content.slice(content.indexOf('rg'), content.indexOf('\nf\n'));
    expect(fill.split('\n').filter((l) => l === 'h')).toHaveLength(1);
    expect(fill).not.toContain('20 20 m');
    const stroke = content.slice(content.indexOf('RG'), content.indexOf('\nS\n'));
    expect(stroke).toContain('0 0 m');
    expect(stroke).toContain('20 20 m');
  });

  it('fills even-odd with f*', async () => {
    const { content } = await render([
      { kind: 'path', path: { ...mixed, fillRule: 'evenodd' }, fill: { paint: { color: '#000' } } },
    ]);
    expect(content).toContain('\nf*\n');
  });

  it('nests a group as q cm … Q and multiplies alpha into an ExtGState', async () => {
    const { s, content } = await render([
      {
        kind: 'group',
        alpha: 0.5,
        transform: Float64Array.from([2, 0, 0, 0, 3, 0, 5, 6, 1]),
        children: [
          {
            kind: 'group',
            alpha: 0.5,
            children: [{ kind: 'path', path: rect, fill: { paint: { color: '#ff0000' } } }],
          },
        ],
      },
    ]);
    expect(content).toContain('q\n2 0 0 3 5 6 cm\n');
    expect(content.match(/^Q$/gm)).toHaveLength(content.match(/^q$/gm)?.length ?? -1);
    expect(s).toContain('/ca 0.25');
    expect(s).toContain('/CA 0.25');
    expect(s).toMatch(/\/ExtGState <</);
  });

  it('clips a group to its path', async () => {
    const { content } = await render([
      {
        kind: 'group',
        clip: rect,
        children: [{ kind: 'path', path: rect, fill: { paint: { color: '#00f' } } }],
      },
    ]);
    const clip = content.indexOf('0 0 10 20 re\nW\nn\n');
    expect(clip).toBeGreaterThan(-1);
    expect(content.indexOf('rg', clip)).toBeGreaterThan(clip);
  });

  it('clips even-odd with W*', async () => {
    const { content } = await render([
      { kind: 'group', clip: { ...mixed, fillRule: 'evenodd' }, children: [] },
    ]);
    expect(content).toContain('W*\nn\n');
  });

  it('writes a solid fill as rg and its opacity through ca', async () => {
    const { s, content } = await render([
      { kind: 'path', path: rect, fill: { paint: { color: '#ff0000', opacity: 0.5 } } },
    ]);
    expect(content).toContain('1 0 0 rg\n');
    expect(content).toContain('0 0 10 20 re\nf\n');
    expect(s).toContain('/ca 0.5');
  });

  it('writes a plain stroke as RG, w and S', async () => {
    const { content } = await render([
      { kind: 'path', path: rect, stroke: { paint: { color: '#0000ff' }, width: 3 } },
    ]);
    expect(content).toContain('0 0 1 RG\n');
    expect(content).toContain('3 w\n');
    expect(content).toContain('0 0 10 20 re\nS\n');
  });

  it('skips an unregistered texture', async () => {
    const { skipped } = await render([
      { kind: 'path', path: rect, fill: { paint: { kind: 'texture', texture: { id: 'tex_none' } } } },
    ]);
    expect(skipped.map((k) => k.detail)).toEqual(['texture tex_none cannot be drawn']);
  });

  it('reports a vertex-colored fill as drawn in its solid fill', async () => {
    const { content, skipped } = await render([
      { kind: 'path', path: rect, fill: { paint: { color: '#000' } }, vertexColors: [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 1, 1, 1] },
    ]);
    expect(content).toContain('0 0 0 rg\n');
    expect(skipped.map((k) => k.detail)).toEqual(['fill vertexColors approximated by the solid fill']);
  });

  it('rasterizes a fill in a registered paint kind, and skips it with no hook', async () => {
    const dispose = registerPaintDrawKind({ id: 'pdf-test-kind' });
    try {
      const fill = { paint: { kind: 'pdf-test-kind' } as never };
      const cmd: DrawCommand = { kind: 'path', path: rect, fill, stroke: { paint: { color: '#00f' }, width: 1 } };
      const rasterize = vi.fn(async () => ({ width: 2, height: 2, data: new Uint8ClampedArray(16).fill(255) }));
      const drawn = await render([cmd], { rasterize });
      expect(drawn.skipped).toEqual([]);
      const [cmds, box] = rasterize.mock.calls[0] as unknown as [DrawCommand[], { width: number; height: number }];
      expect(cmds).toHaveLength(1);
      expect(cmds[0]).toMatchObject({ kind: 'group', children: [{ kind: 'path', path: rect, fill }] });
      expect((cmds[0] as { children: { stroke?: unknown }[] }).children[0].stroke).toBeUndefined();
      expect(box.width).toBeGreaterThan(0);
      expect(drawn.content).toMatch(/\/Im1 Do\n/);
      expect(drawn.content).toContain('0 0 1 RG\n');

      const bare = await render([cmd]);
      expect(bare.skipped.map((k) => k.detail)).toEqual(['paint kind pdf-test-kind needs a raster']);
    } finally {
      dispose();
    }
  });

  it('drops a command with a non-finite coordinate and draws the rest', async () => {
    const { content, skipped } = await render([
      { kind: 'path', path: { ...rect, x: Number.NaN }, fill: { paint: { color: '#0f0' } } },
      { kind: 'group', transform: Float64Array.from([1, 0, 0, 0, 1, 0, Infinity, 0, 1]), children: [{ kind: 'path', path: rect, fill: { paint: { color: '#0f0' } } }] },
      { kind: 'path', path: rect, fill: { paint: { color: '#f00' } } },
    ]);
    expect(skipped).toEqual([
      { kind: 'command', detail: 'path has a non-finite coordinate' },
      { kind: 'command', detail: 'group has a non-finite coordinate' },
    ]);
    expect(content).not.toContain('0 1 0 rg');
    expect(content).toContain('1 0 0 rg\n');
    expect(content.match(/^Q$/gm)).toHaveLength(content.match(/^q$/gm)?.length ?? -1);
  });
});
