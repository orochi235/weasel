/**
 * A custom WGSL program the GPU refuses: WebGPU says so only after the
 * frame that first draws it, and a refused pipeline set on a pass voids the
 * whole submit, so the renderer must stop drawing it once told.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DrawCommand } from '../../DrawCommand';
import { registerProgram } from '@weasel-js/renderer';
import { closeBackends, openBackends, releaseDevice, requireGpu } from '@weasel-js/renderer/testing/parityHarness';

const BROKEN = registerProgram('refused-wgsl', {
  wgsl: { frag: 'fn fragment(in: Varyings) -> vec4f { return vec4f(undeclared, 1.0); }' },
});

const FRAME: DrawCommand[] = [
  { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 40, height: 30 }, fill: { paint: { color: '#0000ff' } } },
  { kind: 'shader', program: BROKEN, uniforms: {}, bounds: { x: 0, y: 0, w: 10, h: 10 } },
];

afterAll(() => releaseDevice());
beforeEach(requireGpu);
afterEach(() => closeBackends());

describe('a WGSL program the GPU refuses', () => {
  it('draws nothing itself, and stops voiding the frames it is drawn in', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const b = await openBackends({ width: 40, height: 30, dpr: 1 });
    b.gpu.render(FRAME);
    await b.device.queue.onSubmittedWorkDone();
    await new Promise((r) => setTimeout(r, 50));
    b.gpu.render(FRAME);
    const px = await b.gpu.readPixels({ x: 30, y: 20, width: 1, height: 1 });
    error.mockRestore();
    expect(Array.from(px)).toEqual([0, 0, 255, 255]);
  });
});
