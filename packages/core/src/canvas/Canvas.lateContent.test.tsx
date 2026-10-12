/**
 * Content that becomes drawable after the frame that asked for it — an image
 * finishing its decode — repaints a bare `<Canvas>`, with no `<SceneCanvas>`
 * around it listening on its behalf.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { Canvas } from './Canvas';
import type { RenderLayer } from '../core/layers/render';
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';

const imageReady = vi.hoisted(() => new Set<() => void>());
vi.mock('@weasel-js/renderer', async (original) => ({
  ...(await original<typeof import('@weasel-js/renderer')>()),
  subscribeImageReady: (cb: () => void) => {
    imageReady.add(cb);
    return () => { imageReady.delete(cb); };
  },
}));

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

describe('<Canvas> late content', () => {
  it('repaints when an image finishes decoding, and stops listening on unmount', async () => {
    const draw = vi.fn(() => []);
    const probe: RenderLayer<unknown> = { id: 'probe', label: 'Probe', draw };
    const { unmount } = render(<Canvas width={100} height={80} layers={{ probe: { layer: probe } }} />);
    await frame();
    expect(draw).toHaveBeenCalledTimes(1);

    act(() => { for (const cb of [...imageReady]) cb(); });
    await frame();
    expect(draw).toHaveBeenCalledTimes(2);

    unmount();
    expect(imageReady.size).toBe(0);
  });
});
