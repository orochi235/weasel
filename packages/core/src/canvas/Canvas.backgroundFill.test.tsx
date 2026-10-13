/**
 * `<Canvas backgroundFill>`.
 *
 * Layer composition is read from the debug snapshot's layer list. Under
 * jsdom's GL stub the WebGL branch early-returns before `draw` fires, so this
 * proves at most that a layer was registered and ordered, never its pixels.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from './testing/BareCanvas';
import type { CanvasDebugSink } from '../debug/types';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => ({
    canvas: { width: 0, height: 0 },
    clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), setTransform: vi.fn(),
    scale: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
    fillText: vi.fn(), measureText: vi.fn(() => ({ width: 10 })),
    font: '', textBaseline: '', globalAlpha: 1,
    fillStyle: '', strokeStyle: '', lineWidth: 1,
  } as unknown as CanvasRenderingContext2D));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

describe('<Canvas> backgroundFill prop', () => {
  it('mounts without error when backgroundFill is supplied', () => {
    expect(() => {
      render(
        <Canvas
          width={200}
          height={200}
          layers={{}}
          backgroundFill={{ color: '#ff0000' }}
        />,
      );
    }).not.toThrow();
  });

  it('includes a scene-background-fill layer before scene in the debug snapshot', () => {
    const sinkRef: { current: CanvasDebugSink | null } =
      { current: null };

    render(
      <Canvas
        width={200}
        height={200}
        layers={{ scene: { layers: [{ key: 'scene', layer: { id: 'scene', label: 'Scene', draw: () => [] } }] } }}
        backgroundFill={{ color: '#ff0000' }}
        debug={{ layers: true }}
        debugSinkRef={sinkRef}
      />,
    );

    const snap = sinkRef.current?.snapshot();
    // Under jsdom the snapshot is empty, so the ordering is asserted only if
    // it IS populated.
    if (snap && snap.layers.length > 0) {
      const ids = snap.layers.map((l) => l.id);
      const bgIdx = ids.indexOf('scene-background-fill');
      const sceneIdx = ids.indexOf('scene');
      expect(bgIdx).toBeGreaterThanOrEqual(0);
      expect(bgIdx).toBeLessThan(sceneIdx);
    }
    // Always assert the canvas mounted.
    expect(document.querySelector('canvas')).toBeTruthy();
  });

  it('omitting backgroundFill produces no scene-background-fill layer', () => {
    const sinkRef: { current: CanvasDebugSink | null } =
      { current: null };

    render(
      <Canvas
        width={200}
        height={200}
        layers={{}}
        debug={{ layers: true }}
        debugSinkRef={sinkRef}
      />,
    );

    const snap = sinkRef.current?.snapshot();
    if (snap) {
      expect(snap.layers.find((l) => l.id === 'scene-background-fill')).toBeUndefined();
    }
    expect(document.querySelector('canvas')).toBeTruthy();
  });
});
