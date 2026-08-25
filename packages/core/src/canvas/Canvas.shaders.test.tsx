/**
 * Shaders passed at mount must reach the renderer, which is built on the
 * first painted frame — later than any effect on the mounting commit.
 * Canvas.test.tsx can only smoke-test this: its ambient getContext stub has
 * no WebGL2 methods, so no renderer is ever built there.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from './Canvas';
import { WeaselRenderer } from '../renderer/WeaselRenderer';
import { registerProgram } from '../renderer';
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

const FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
void main() { outColor = vec4(0.0, 0.0, 0.0, 1.0); }`;

describe('Canvas shaders prop', () => {
  it('registers shaders supplied at mount on the renderer it builds', async () => {
    const handle = registerProgram('canvas-shaders-mount', '', FRAGMENT);
    const spy = vi.spyOn(WeaselRenderer.prototype, 'registerProgram');

    render(<Canvas width={100} height={100} layers={{}} shaders={[handle]} />);
    await waitForFrame();

    expect(spy.mock.calls.map(([h]) => h.id)).toContain('canvas-shaders-mount');
    spy.mockRestore();
  });

  it('registers a shader added after mount', async () => {
    const first = registerProgram('canvas-shaders-first', '', FRAGMENT);
    const second = registerProgram('canvas-shaders-second', '', FRAGMENT);

    const { rerender } = render(
      <Canvas width={100} height={100} layers={{}} shaders={[first]} />,
    );
    await waitForFrame();

    const spy = vi.spyOn(WeaselRenderer.prototype, 'registerProgram');
    rerender(<Canvas width={100} height={100} layers={{}} shaders={[first, second]} />);
    await waitForFrame();

    expect(spy.mock.calls.map(([h]) => h.id)).toContain('canvas-shaders-second');
    spy.mockRestore();
  });
});
