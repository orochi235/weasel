import { describe, expect, it, vi } from 'vitest';
import { mat3, PathBuilder } from '@weasel-js/geom';
import type { DrawCommand, TextDrawCommand } from '@weasel-js/renderer';
import type { ResolvedRun } from '@weasel-js/text';
import { parseLbx, type ImageObject, type LineObject, type RectObject, type TextObject } from 'bil-lbx';
import { tapeForWidthMm } from '../tape';
import { lbxConfig, writeLbx } from './writeLbx';

const tape = tapeForWidthMm(12)!;
const page = (commands: DrawCommand[]) => ({ length: 144, tape, commands });

const rect = (x: number, y: number, width: number, height: number, extra: Partial<Extract<DrawCommand, { kind: 'path' }>> = {}): DrawCommand => ({
  kind: 'path',
  path: { kind: 'rect', x, y, width, height },
  ...extra,
});

function run(text: string, over: Partial<ResolvedRun> = {}): ResolvedRun {
  return {
    text, fontFamily: 'Helvetica', fontSize: 12, fontWeight: 700, fontStyle: 'normal',
    fill: { paint: { color: '#000000' } }, letterSpacing: 0, underline: false, strikethrough: false,
    overline: false, baselineShift: 0, ...over,
  } as ResolvedRun;
}

const text = (runs: ResolvedRun[], over: Partial<TextDrawCommand> = {}): DrawCommand => ({
  kind: 'text', x: 10, y: 4, runs, width: 80, maxWidth: 80, height: 20, style: {}, align: 'center', verticalAlign: 'center', ...over,
});

describe('lbxConfig', () => {
  it('writes a filled, stroked rect as a draw:rect framed at the stroke outer edge', async () => {
    const { config, skipped } = await lbxConfig(page([
      rect(10, 5, 40, 20, { fill: { paint: { color: 'white' } }, stroke: { paint: { color: '#000' }, width: 2 } }),
    ]));
    expect(skipped).toEqual([]);
    expect(config.objects).toEqual([{
      type: 'rect',
      shape: 'RECTANGLE',
      position: { x: 9, y: 4, width: 42, height: 22 },
      pen: { style: 'INSIDEFRAME', widthX: 2, widthY: 2, color: '#000000' },
      brush: { style: 'SOLID', color: '#ffffff' },
    } satisfies RectObject]);
  });

  it('places objects through group transforms', async () => {
    const { config } = await lbxConfig(page([{
      kind: 'group',
      transform: mat3.scaled(mat3.translated(mat3.identity(), 20, 2), 2, 2),
      children: [rect(1, 1, 5, 5, { fill: { paint: { color: '#000' } } })],
    }]));
    expect((config.objects[0] as RectObject).position).toEqual({ x: 22, y: 4, width: 10, height: 10 });
  });

  it('writes an open polyline as a draw:poly in page points', async () => {
    const path = new PathBuilder().moveTo(0, 0).lineTo(30, 10).lineTo(60, 0).build();
    const { config } = await lbxConfig(page([
      { kind: 'group', transform: mat3.translated(mat3.identity(), 5, 5), children: [{ kind: 'path', path, stroke: { paint: { color: '#000' }, width: 1, cap: 'round' } }] },
    ]));
    const line = config.objects[0] as LineObject;
    expect(line.type).toBe('line');
    expect(line.points).toEqual([{ x: 5, y: 5 }, { x: 35, y: 15 }, { x: 65, y: 5 }]);
    expect(line.position).toEqual({ x: 5, y: 5, width: 60, height: 10 });
    expect(line.arrowBegin).toBe('ROUND');
  });

  it('writes plain text in a box as a text:text', async () => {
    const { config } = await lbxConfig(page([text([run('Hello '), run('there', { underline: false })])]));
    const obj = config.objects[0] as TextObject;
    expect(obj).toMatchObject({
      type: 'text',
      data: 'Hello there',
      position: { x: 10, y: 4, width: 80, height: 20 },
      font: { name: 'Helvetica', size: 12, weight: 700, italic: false },
      horizontalAlignment: 'CENTER',
      verticalAlignment: 'CENTER',
      autoLF: true,
    });
  });

  it('rasterizes what an object cannot state, one image per run, in paint order', async () => {
    const rasterize = vi.fn(async (_commands: readonly DrawCommand[], r: { width: number; height: number }, scale: number) => {
      const width = Math.round(r.width * scale);
      const height = Math.round(r.height * scale);
      const data = new Uint8ClampedArray(width * height * 4);
      // One opaque pixel block at (10..13, 20..21) px.
      for (let y = 20; y < 22; y++) for (let x = 10; x < 14; x++) data[(y * width + x) * 4 + 3] = 255;
      return { width, height, data };
    });
    const translucent = rect(0, 0, 5, 5, { fill: { paint: { color: '#000', opacity: 0.5 } } });
    const mixed = text([run('a'), run('b', { fontSize: 20 })]);
    const solid = rect(50, 5, 5, 5, { fill: { paint: { color: '#000' } } });
    const { config } = await lbxConfig(page([translucent, mixed, solid, translucent]), { rasterize, rasterDpi: 72 });
    expect(config.objects.map((o) => o.type)).toEqual(['image', 'rect', 'image']);
    expect(rasterize).toHaveBeenCalledTimes(2);
    expect(rasterize.mock.calls[0]![0]).toHaveLength(2);
    expect((config.objects[0] as ImageObject).position).toEqual({ x: 10, y: 20, width: 4, height: 2 });
  });

  it('reports what it could not draw without a rasterizer', async () => {
    const { config, skipped } = await lbxConfig(page([rect(0, 0, 5, 5, { fill: { paint: { color: '#000', opacity: 0.5 } } })]));
    expect(config.objects).toEqual([]);
    expect(skipped).toEqual([{ kind: 'path', detail: 'no rasterize hook for what .lbx cannot draw' }]);
  });

  it('writes the tape, the length and the cuts', async () => {
    const fixed = await lbxConfig({ ...page([]), cuts: [72, 0, 200, 36] });
    expect(fixed.config.paper).toMatchObject({ width: 33.6, format: 259, height: 144, autoLength: false });
    expect(fixed.config.cut).toEqual({ freeCut: [36, 72] });
    const auto = await lbxConfig({ ...page([]), autoLength: true });
    expect(auto.config.background!.width).toBeCloseTo(144 - 11.2, 9);
  });
});

describe('writeLbx', () => {
  it('writes a file bil-lbx reads back', async () => {
    const { bytes } = await writeLbx(page([
      rect(10, 5, 40, 20, { stroke: { paint: { color: '#000' }, width: 1 } }),
      text([run('Label')]),
    ]));
    const back = await parseLbx(bytes);
    expect(back.paper.width).toBe(33.6);
    expect(back.objects.map((o) => o.type)).toEqual(['rect', 'text']);
    expect((back.objects[1] as TextObject).data).toBe('Label');
  });
});
