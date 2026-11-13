/**
 * A touch on a canvas that takes input belongs to the canvas: with the
 * browser's default `touch-action`, a finger dragging on it pans the page and
 * the browser cancels the pointer mid-gesture, and two fingers zoom the page
 * instead of reaching the kit's pinch. jsdom resolves no `:where()` rule, so
 * this asserts the marker and the rule; `SurfaceCanvas.test.tsx` holds where
 * the rule lives.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from '@weasel-js/core/testing/BareCanvas';
import { SURFACE_RULE } from './SurfaceCanvas';
import { SceneViewCanvas } from './SceneViewCanvas';
import { createScene } from 'core/scene/scene';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

describe('a canvas and the browser’s touch handling', () => {
  it('keeps touch for itself on a canvas that takes input, at zero specificity', () => {
    const { container } = render(<Canvas width={200} height={200} layers={{}} />);
    expect(container.querySelector('canvas')!.hasAttribute('data-wzl-input')).toBe(true);
    expect(SURFACE_RULE).toContain(':where([data-wzl-input]) { touch-action: none; }');
  });

  it('leaves touch to the page on a canvas that only shows a scene', () => {
    const { container } = render(
      <SceneViewCanvas
        scene={createScene({ systemLayers: [{ id: 'main' }] })} view={{ x: 0, y: 0, scale: { x: 1, y: 1 } }} width={100} height={80}
      />,
    );
    expect(container.querySelector('canvas')!.hasAttribute('data-wzl-input')).toBe(false);
  });
});
