import { describe, expect, it } from 'vitest';
import { IDENTITY_COLOR_MATRIX } from '../state/GroupState';
import { createRecorderCtx } from '../testing/recorderCtx';
import { openRun, runTakes, takeMatrix } from './batchRun';

const TINTED = new Float32Array([1, 0, 0, 0, 0.25, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]);

describe('runTakes', () => {
  it('takes a second color matrix into a run where a program for several draws it', () => {
    const { ctx } = createRecorderCtx();
    const staged = openRun(ctx);
    takeMatrix(staged, IDENTITY_COLOR_MATRIX, 1);
    expect(runTakes(ctx, staged, TINTED, 1)).toBe(true);
  });

  it('refuses a second color matrix where no program for several is there', () => {
    const { ctx: full } = createRecorderCtx();
    const ctx = { ...full, batchVariants: undefined };
    const staged = openRun(ctx);
    takeMatrix(staged, IDENTITY_COLOR_MATRIX, 1);
    expect(runTakes(ctx, staged, IDENTITY_COLOR_MATRIX, 1)).toBe(true);
    expect(runTakes(ctx, staged, TINTED, 1)).toBe(false);
  });
});
