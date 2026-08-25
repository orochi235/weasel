/**
 * The GL renderer is created lazily on the first paint and owns the
 * WebGL2 context, its program registry, texture caches and VBOs. Nothing in
 * React state frees those, so unmount has to.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from './Canvas';
import { WeaselRenderer } from '../renderer/WeaselRenderer';
import { makeGLRecorder } from '../renderer/test-utils/glRecorder';

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

const waitForFrame = () => new Promise<void>(r => requestAnimationFrame(() => r()));

describe('Canvas GL lifecycle', () => {
  it('disposes the renderer on unmount', async () => {
    const dispose = vi.spyOn(WeaselRenderer.prototype, 'dispose');
    const { unmount } = render(<Canvas width={100} height={100} layers={{}} />);
    // The renderer is only built once a frame has painted with a real ctx.
    await waitForFrame();
    expect(dispose).not.toHaveBeenCalled();
    unmount();
    expect(dispose).toHaveBeenCalledOnce();
    dispose.mockRestore();
  });
});
