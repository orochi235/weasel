import { describe, expect, it } from 'vitest';
import { PathBuilder } from '@weasel-js/geom';
import type { DrawCommand, TextDrawCommand } from '@weasel-js/renderer';
import { registerBidi, type BidiEngine, type ResolvedRun } from '@weasel-js/text';
import type { TextObject } from 'bil-lbx';
import { tapeForWidthMm } from '../tape';
import { lbxConfig } from './writeLbx';

const tape = tapeForWidthMm(12)!;
const types = async (commands: DrawCommand[]) =>
  (await lbxConfig({ length: 144, tape, commands })).config.objects.map((o) => o.type);

describe('stroke joins', () => {
  const rect = (miterLimit?: number): DrawCommand => ({
    kind: 'path', path: { kind: 'rect', x: 10, y: 5, width: 40, height: 20 },
    stroke: { paint: { color: '#000' }, width: 2, join: 'miter', miterLimit },
  });

  it('rasterizes a rect whose miter limit bevels its corners', async () => {
    expect(await types([rect(1)])).toEqual([]);
    expect(await types([rect(1.5)])).toEqual(['rect']);
    expect(await types([rect()])).toEqual(['rect']);
  });
});

describe('polylines', () => {
  const line = (points: [number, number][], stroke: Record<string, unknown> = {}): DrawCommand => {
    const b = new PathBuilder().moveTo(...points[0]!);
    for (const p of points.slice(1)) b.lineTo(...p);
    return { kind: 'path', path: b.build(), stroke: { paint: { color: '#000' }, width: 1, ...stroke } };
  };
  const corner: [number, number][] = [[5, 0], [35, 10], [65, 0]];

  it('rasterizes a polyline whose corners are rounded, beveled, or past the miter limit', async () => {
    expect(await types([line(corner)])).toEqual(['line']);
    expect(await types([line(corner, { join: 'round' })])).toEqual([]);
    expect(await types([line(corner, { join: 'bevel' })])).toEqual([]);
    expect(await types([line([[5, 0], [10, 40], [15, 0]])])).toEqual([]);
    expect(await types([line([[5, 0], [65, 0]], { join: 'round' })])).toEqual(['line']);
  });

  it('rasterizes a line under auto length whose stroke reaches past the end, though its points do not', async () => {
    const auto = async (cmd: DrawCommand) =>
      (await lbxConfig({ length: 100, tape, commands: [cmd], autoLength: true })).config.objects.map((o) => o.type);
    expect(await auto(line([[10, 5], [100, 5]], { width: 6, cap: 'round' }))).toEqual([]);
    expect(await auto(line([[99, 5], [99, 30]], { width: 4, cap: 'butt' }))).toEqual([]);
    expect(await auto(line([[20, 5], [3, 10], [20, 15]], { width: 4 }))).toEqual([]);
    expect(await auto(line([[3, 5], [97, 5]], { width: 6, cap: 'round' }))).toEqual(['line']);
  });

  it('rasterizes a square-capped line, whose ends reach past its points', async () => {
    expect(await types([line([[5, 0], [65, 0]], { cap: 'square' })])).toEqual([]);
    expect(await types([line([[5, 0], [65, 0]], { cap: 'butt' })])).toEqual(['line']);
  });
});

describe('text boxes', () => {
  const run = (text: string, over: Partial<ResolvedRun> = {}): ResolvedRun => ({
    text, fontFamily: 'Helvetica', fontSize: 12, fontWeight: 400, fontStyle: 'normal',
    fill: { paint: { color: '#000000' } }, letterSpacing: 0, underline: false, strikethrough: false,
    overline: false, baselineShift: 0, ...over,
  });
  const box = (over: Partial<TextDrawCommand> = {}, runs = [run('Label')]): DrawCommand => ({
    kind: 'text', x: 10, y: 4, runs, width: 80, maxWidth: 80, height: 20, style: {}, ...over,
  });
  const written = async (cmd: DrawCommand) =>
    (await lbxConfig({ length: 144, tape, commands: [cmd] })).config.objects[0] as TextObject | undefined;

  it('turns auto line feed on only for a box that wraps', async () => {
    expect((await written(box()))?.autoLF).toBe(true);
    expect((await written(box({ maxWidth: Infinity })))?.autoLF).toBe(false);
    expect((await written(box({ maxWidth: undefined })))?.autoLF).toBe(false);
  });

  it('rasterizes a box that wraps at a width other than the one it aligns in', async () => {
    expect(await written(box({ width: 200, maxWidth: 100 }))).toBeUndefined();
    expect((await written(box({ width: undefined, maxWidth: 100 })))?.position.width).toBe(100);
    expect((await written(box({ width: 200, maxWidth: Infinity })))?.position.width).toBe(200);
  });

  it('rasterizes a box any of whose paragraphs the canvas lays out right to left', async () => {
    expect(await written(box({ direction: 'rtl' }))).toBeUndefined();
    expect(await written(box({ style: { direction: 'rtl' } }))).toBeUndefined();
    expect(await written(box({ direction: 'ltr', style: { direction: 'rtl' } }))).toBeDefined();
    // A stand-in engine reading Hebrew letters as right to left: the canvas resolves `auto` through the registered one.
    const hebrew = (cps: readonly number[]) => cps.some((cp) => cp >= 0x5d0 && cp <= 0x5ea);
    const off = registerBidi({ analyze: (cps: readonly number[]) => cps, paragraphLevel: (cps: never) => (hebrew(cps) ? 1 : 0) } as unknown as BidiEngine);
    try {
      expect(await written(box({}, [run('Label\n\u05e9\u05dc\u05d5\u05dd')]))).toBeUndefined();
      expect(await written(box({ direction: 'ltr' }, [run('\u05e9\u05dc\u05d5\u05dd')]))).toBeDefined();
      expect(await written(box())).toBeDefined();
    } finally {
      off();
    }
  });

  it('rasterizes a box whose runs turn on font features or hold their line at another size', async () => {
    expect(await written(box({}, [run('Label', { fontFeatures: ['smcp'] })]))).toBeUndefined();
    expect(await written(box({}, [run('a'), run('b', { strutSize: 16 })]))).toBeUndefined();
    expect(await written(box({}, [run('Label', { fontFeatures: [], strutSize: 12 })]))).toBeDefined();
  });

  it('rasterizes a box of more than one line at a line height of its own, or a tab at a tab size of its own', async () => {
    expect(await written(box({ style: { lineHeight: 2 } }, [run('one\ntwo')]))).toBeUndefined();
    expect(await written(box({ style: { lineHeight: 2 } }))).toBeUndefined();
    expect(await written(box({ maxWidth: Infinity, style: { lineHeight: 2 } }))).toBeDefined();
    expect(await written(box({ style: { tabSize: 2 } }, [run('a\tb')]))).toBeUndefined();
    expect(await written(box({ style: { tabSize: 2 } }))).toBeDefined();
  });
});
