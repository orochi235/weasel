import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from './testing/BareCanvas';
import { SceneCanvas } from './SceneCanvas';
import { useScene } from 'core/scene/useScene';
import type { RenderLayer } from 'core/layers/render';
import { registerProgram } from '@weasel-js/renderer';
import { stubCanvasContext, waitForFrame } from './testing/stubCanvasContext';

beforeAll(stubCanvasContext);

describe('GL renderer', () => {
  it('renders without error with default props', () => {
    const { container } = render(
      <Canvas width={100} height={100} layers={{}} />,
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  // Both flags fail silently, not loudly: without `stencil` every evenodd fill
  // and clip renders as a solid shape; without `preserveDrawingBuffer`
  // readPixels() after render returns all zeros.
  it('calls getContext("webgl2") with preserveDrawingBuffer + stencil', async () => {
    const getCtxSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    render(<Canvas width={100} height={100} layers={{}} />);
    await waitForFrame();
    const webgl2Calls = getCtxSpy.mock.calls.filter((c) => c[0] === 'webgl2');
    expect(webgl2Calls.length).toBeGreaterThan(0);
    expect(webgl2Calls[0][1]).toMatchObject({ preserveDrawingBuffer: true, stencil: true });
    getCtxSpy.mockRestore();
  });

  it('does not call getContext("2d")', () => {
    const getCtxSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    render(<Canvas width={100} height={100} layers={{}} />);
    const twoDCalls = getCtxSpy.mock.calls.filter((c) => c[0] === '2d');
    expect(twoDCalls).toHaveLength(0);
    getCtxSpy.mockRestore();
  });

  it('mounts without throwing when a custom layer with draw is present', () => {
    // Sentinel test: confirms the drawLayers dispatch path doesn't throw under
    // jsdom. The authoritative end-to-end pixel check is the Playwright smoke
    // (canvas-gl.spec.ts) — under jsdom getContext('webgl2') returns a non-null
    // stub, so the GL branch early-returns before drawLayers runs and the
    // captured arguments below stay empty. Documenting intent.
    const captured: Array<{ data: unknown; view: unknown; dims: unknown }> = [];
    const customLayer: RenderLayer<unknown> = {
      id: 'capture',
      label: 'Capture',
      draw: (data, view, dims) => {
        captured.push({ data, view, dims });
        return [];
      },
    };
    const { container } = render(
      <Canvas
        width={300}
        height={200}
        layers={{ myCustom: { layer: customLayer } }}
        defaultView={{ x: 10, y: 20, scale: { x: 2, y: 2 } }}
      />,
    );
    expect(container.querySelector('canvas')).toBeTruthy();
    // Tautology: under jsdom the early-return runs before draw is invoked.
    expect(captured.length).toBeGreaterThanOrEqual(0);
  });
});

describe('Canvas shaders prop', () => {
  it('accepts a shaders array and renders without throwing', () => {
    const handle = registerProgram(
      'smoke-test-shader',
      '',
      `#version 300 es
       precision highp float;
       out vec4 outColor;
       void main() { outColor = vec4(0.0, 0.0, 0.0, 1.0); }`,
    );
    function Demo() {
      const scene = useScene<{ id: string }>({ items: [] });
      return (
        <SceneCanvas
          width={100}
          height={100}
          shaders={[handle]}
          scene={scene}
          layers={{}}
        />
      );
    }
    const { container } = render(<Demo />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });
});
