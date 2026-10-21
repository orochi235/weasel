import { describe, expect, it } from 'vitest';
import { stageFromType } from '../stageTypes';
import type { EffectStage } from '../types';
import type { EffectEvalContext } from '../runner/types';
import { imageEvaluators } from './evaluators';
import { IMAGE_STAGE_TYPES } from './stageTypes';
import { testCard } from './testCard';
import { imageValueKinds } from './valueKinds';

const W = 16;
const H = 8;

/** A W×H bitmap painted by `paint`. */
function bitmap(paint: (ctx: OffscreenCanvasRenderingContext2D) => void): ImageBitmap {
  const c = new OffscreenCanvas(W, H);
  paint(c.getContext('2d')!);
  return c.transferToImageBitmap();
}
const solid = (color: string) => bitmap((ctx) => { ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); });

/** RGBA at (x, y). */
function pixel(image: unknown, x: number, y: number): number[] {
  const b = image as ImageBitmap;
  const c = new OffscreenCanvas(b.width, b.height);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(b, 0, 0);
  return [...ctx.getImageData(x, y, 1, 1).data];
}

const stageOf = (type: string): EffectStage => stageFromType(IMAGE_STAGE_TYPES.find((t) => t.type === type)!, type);

async function evaluate(type: string, inputs: Record<string, unknown>, params: Record<string, unknown> = {}, more: Partial<EffectEvalContext> = {}) {
  const stage = more.stage ?? stageOf(type);
  const defaults = Object.fromEntries((stage.params ?? []).map((p) => [p.label, p.control?.value]));
  return imageEvaluators[type]!({
    stage, inputs, params: { ...defaults, ...params }, sources: {}, time: 0, signal: new AbortController().signal, ...more,
  });
}

describe('imageEvaluators', () => {
  it('a source puts out the image it was handed, and fails without one', async () => {
    const card = solid('#00f');
    expect((await evaluate('source', {}, {}, { sources: { image: card } })).outputs.out).toBe(card);
    expect(() => imageEvaluators.source!({ stage: stageOf('source'), inputs: {}, params: {}, sources: {}, time: 0, signal: new AbortController().signal }))
      .toThrow(/source image/);
  });

  it('a blur softens a hard edge', async () => {
    const half = bitmap((ctx) => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W / 2, H); });
    const sharp = pixel(half, W / 2 - 1, H / 2)[0]!;
    const { outputs } = await evaluate('blur', { in: half }, { radius: 3 });
    const soft = pixel(outputs.out, W / 2 - 1, H / 2)[0]!;
    expect(sharp).toBe(0);
    expect(soft).toBeGreaterThan(40);
  });

  it('a composite blends its top over its base by its blend', async () => {
    const base = solid('rgb(255, 0, 0)');
    const top = solid('rgb(128, 128, 128)');
    const at = async (blend: string) => pixel((await evaluate('composite', { base, top }, { blend })).outputs.out, 4, 4).slice(0, 3);
    expect(await at('normal')).toEqual([128, 128, 128]);
    const multiply = await at('multiply');
    expect(multiply[0]).toBeGreaterThan(120);
    expect(multiply[0]).toBeLessThan(136);
    expect(multiply[1]).toBe(0);
    expect(await at('screen')).toEqual([255, 128, 128]);
  });

  it('a mask keeps the image only where the mask is opaque', async () => {
    const mask = bitmap((ctx) => { ctx.fillStyle = '#fff'; ctx.fillRect(W / 2, 0, W / 2, H); });
    const { outputs } = await evaluate('mask', { in: solid('#0f0'), mask });
    expect(pixel(outputs.out, 2, 4)[3]).toBe(0);
    expect(pixel(outputs.out, W - 2, 4)).toEqual([0, 255, 0, 255]);
  });

  it('fails a stage that is missing an input it needs', async () => {
    await expect(async () => evaluate('mask', { in: solid('#0f0') })).rejects.toThrow(/mask/);
  });

  it('an oscillator puts out sin(2π·rate·t)', async () => {
    const at = async (time: number) => (await evaluate('oscillator', {}, { rate: 1 }, { time })).outputs.value as number;
    expect(await at(0)).toBeCloseTo(0);
    expect(await at(0.25)).toBeCloseTo(1);
    expect(await at(0.75)).toBeCloseTo(-1);
  });

  it('a decision sends its image to its first output while the tested number is above 0, else its second', async () => {
    const image = solid('#fff');
    expect(await evaluate('decision', { in: image, test: 0.5 })).toEqual({ outputs: { yes: image }, taken: 'yes' });
    expect(await evaluate('decision', { in: image, test: 0 })).toEqual({ outputs: { no: image }, taken: 'no' });
  });

  it('a decision with a split picks the band the tested number falls in', async () => {
    const image = solid('#fff');
    const stage: EffectStage = {
      ...stageOf('decision'),
      outputs: [{ id: 'low', type: 'image' }, { id: 'mid', type: 'image' }, { id: 'high', type: 'image' }],
      split: { input: 'test', at: [0, 0.5] },
    };
    expect((await evaluate('decision', { in: image, test: -1 }, {}, { stage })).taken).toBe('low');
    expect((await evaluate('decision', { in: image, test: 0.2 }, {}, { stage })).taken).toBe('mid');
    expect((await evaluate('decision', { in: image, test: 0.5 }, {}, { stage })).taken).toBe('high');
  });
});

describe('imageValueKinds and testCard', () => {
  it('shows an image by its size, previews it at the size asked, and closes it on dispose', async () => {
    const card = testCard({ width: 64, height: 32 });
    expect(imageValueKinds.image!.show!(card)).toBe('64×32');
    const preview = await imageValueKinds.image!.preview!(card, { width: 24, height: 24 });
    expect(preview!.width).toBeGreaterThanOrEqual(24);
    expect(preview).not.toBe(card);
    imageValueKinds.image!.dispose!(card);
    expect(card.width).toBe(0);
  });

  it('draws a test card that is not one flat color', () => {
    const card = testCard(32);
    expect(pixel(card, 2, 2)).not.toEqual(pixel(card, 30, 2));
  });
});
