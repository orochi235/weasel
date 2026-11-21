import { describe, expect, it } from 'vitest';
import { imageSourceInLatestFrame } from '../cache/GLImageCache';
import { glProgramHandle } from '../gpu/webgl/GlProgram';
import { createRecorderCtx, isBatchBuild } from './recorderCtx';

describe('isBatchBuild', () => {
  it('accepts every build a batch run draws with', () => {
    const { ctx } = createRecorderCtx();
    const variants = ctx.batchVariants!;
    for (const matrices of [false, true]) {
      for (const hulls of [false, true]) {
        for (const area of [false, true]) {
          expect(isBatchBuild(ctx, glProgramHandle(variants.get(matrices, hulls, area))), `${matrices} ${hulls} ${area}`).toBe(true);
        }
      }
    }
    expect(isBatchBuild(ctx, glProgramHandle(ctx.batchFill))).toBe(true);
    expect(isBatchBuild(ctx, glProgramHandle(ctx.pathFill))).toBe(false);
  });
});

describe('createRecorderCtx', () => {
  const key = {};

  it('answers for an image its test drew', () => {
    const { ctx } = createRecorderCtx();
    ctx.imageCache.upload(key, { width: 2, height: 2 } as unknown as ImageBitmap);
    expect(imageSourceInLatestFrame(key)).toBe(true);
  });

  it('stops answering once that test has finished', () => {
    expect(imageSourceInLatestFrame(key)).toBe(false);
  });
});
