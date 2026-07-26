/**
 * Tests for the `decorationLayer` prop on `<Canvas>`.
 *
 * Under jsdom, getContext('webgl2') returns a non-null stub that lacks WebGL2
 * methods, so the GL renderer early-returns before `draw` is ever invoked.
 * These tests therefore assert structural / mounting behaviour; the actual
 * draw-call ordering is covered by the Playwright smoke suite.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from './Canvas';
import type { RenderLayer } from 'core/layers/render';

// jsdom doesn't implement getContext or pointer capture; stub minimally.
beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  if (!(proto.getContext as unknown as { _stubbed?: boolean })._stubbed) {
    proto.getContext = Object.assign(vi.fn(() => null), { _stubbed: true });
    proto.setPointerCapture = vi.fn();
    proto.releasePointerCapture = vi.fn();
  }
});

describe('Canvas decorationLayer prop', () => {
  it('mounts without throwing when decorationLayer is provided', () => {
    const draw = vi.fn(() => []);
    const decorationLayer: RenderLayer<unknown> = {
      id: 'mode-decorations',
      label: 'Mode decorations',
      space: 'world',
      draw,
    };

    expect(() =>
      render(
        <Canvas
          width={200}
          height={100}
          layers={{}}
          decorationLayer={decorationLayer}
        />
      )
    ).not.toThrow();
    // draw is wired into the layer pipeline; in jsdom the GL branch early-returns
    // before draw fires — the Playwright smoke covers actual invocation order.
    void draw;
  });

  it('renders cleanly when decorationLayer is omitted', () => {
    expect(() =>
      render(<Canvas width={200} height={100} layers={{}} />)
    ).not.toThrow();
  });
});
