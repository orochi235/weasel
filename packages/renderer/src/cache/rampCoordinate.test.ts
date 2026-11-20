import { describe, expect, it } from 'vitest';
import { mat3 } from '@weasel-js/geom';
import type { Paint } from '@weasel-js/paint';
import { buildGradientRamp, rampU, RAMP_U_OFFSET, RAMP_U_SCALE, RAMP_WIDTH } from './GradientRampAtlas';
import { batchPaint } from '../draw/gradient';
import type { DrawContext } from '../draw/drawContext';
import { GRAD_PAINT_GLSL } from '../shaders/gradFill';
import { BATCH_FRAG_SRC } from '../shaders/batchFill';
import { GRAD_PAINT_WGSL } from '../gpu/webgpu/wgsl/gradFill';
import { BATCH_BUILDS, batchFillWgsl } from '../gpu/webgpu/wgsl/batchFill';

/** The red channel a LINEAR, CLAMP_TO_EDGE sampler reads from a ramp at `u`. */
function sampleRed(ramp: Uint8ClampedArray, u: number): number {
  const x = Math.min(Math.max(u * RAMP_WIDTH - 0.5, 0), RAMP_WIDTH - 1);
  const i = Math.floor(x);
  const j = Math.min(i + 1, RAMP_WIDTH - 1);
  return ramp[i * 4] + (ramp[j * 4] - ramp[i * 4]) * (x - i);
}

const RAMP = buildGradientRamp([{ offset: 0, color: '#000000' }, { offset: 1, color: '#ff0000' }]);

describe('a ramp position as a texture coordinate', () => {
  it('samples the color the ramp holds at that position, ends included', () => {
    for (const t of [0, 0.1, 0.25, 0.5, 0.9, 1]) {
      expect(sampleRed(RAMP, t * RAMP_U_SCALE + RAMP_U_OFFSET)).toBeCloseTo(t * 255, 6);
    }
  });

  it('is what every shader sampling the ramp atlas reads it through', () => {
    for (const src of [GRAD_PAINT_GLSL, GRAD_PAINT_WGSL.code, BATCH_FRAG_SRC, batchFillWgsl(BATCH_BUILDS[0]!)]) {
      expect(src).toContain(rampU('t'));
    }
  });

  it('is what a batched linear gradient puts in its vertices', () => {
    const ctx = { state: { transform: mat3.identity(), paintFrame: mat3.identity() } } as unknown as DrawContext;
    const fill: Paint = {
      kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 100, y: 0 },
      stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#f00' }],
    } as Paint;
    const paint = batchPaint(ctx, fill, false);
    if (!paint || paint.kind !== 'ramp') throw new Error('expected a ramp paint');
    const u = (x: number) => paint.uv.ux * x + paint.uv.u0;
    for (const x of [0, 10, 90, 100]) expect(sampleRed(RAMP, u(x))).toBeCloseTo(x / 100 * 255, 4);
  });
});
