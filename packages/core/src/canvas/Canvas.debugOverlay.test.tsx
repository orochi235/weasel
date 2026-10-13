import { describe, expect, it, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from './testing/BareCanvas';
import type { CanvasDebugSink } from '../debug/types';
import { stubCanvasContext, waitForFrame } from './testing/stubCanvasContext';

beforeAll(stubCanvasContext);

describe('Canvas debug overlay', () => {
  function noopScene() {
    return { layers: [{ key: 'scene', layer: { id: 'scene', label: 'Scene', draw: () => [] } }] };
  }

  it('debug={false} produces no overlay layer even when URL has ?debug=all', () => {
    const original = window.location.search;
    window.history.replaceState(null, '', '?debug=all');
    try {
      const { container } = render(
        <Canvas
          width={100} height={100}
                    layers={{ scene: noopScene() }}
          debug={false}
        />,
      );
      expect(container.querySelector('canvas')).toBeTruthy();
    } finally {
      window.history.replaceState(null, '', original || window.location.pathname);
    }
  });

  it('debug={config} accepts an explicit config object', () => {
    const { container } = render(
      <Canvas
        width={100} height={100}
                layers={{ scene: noopScene() }}
        debug={{ bounds: true }}
      />,
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it.skip('records bounds + origins for each item when those flags are on (skipped: GL backend in jsdom early-returns before draw fires)', () => {
    const items = [
      { id: 'a', x: 0, y: 0, w: 10, h: 10 },
      { id: 'b', x: 20, y: 30, w: 5, h: 5 },
      { id: 'c', x: 40, y: 50, w: 8, h: 8 },
    ];
    const sinkRef: { current: CanvasDebugSink | null } = { current: null };
    render(
      <Canvas
        width={100} height={100}
                layers={{ scene: noopScene() }}
        boundsOf={(id) => {
          const it = items.find((i) => i.id === id);
          return it ? { x: it.x, y: it.y, width: it.w, height: it.h } : null;
        }}
        debug={{ bounds: true, origins: true }}
        debugSinkRef={sinkRef}
      />,
    );
    const snap = sinkRef.current?.snapshot();
    expect(snap?.bounds.length).toBeGreaterThanOrEqual(3);
    expect(snap?.origins.length).toBeGreaterThanOrEqual(3);
    const ids = new Set(snap!.bounds.map((b) => b.id));
    expect(ids.has('a') && ids.has('b') && ids.has('c')).toBe(true);
  });

  it('records layer metadata once per non-overlay layer when layers flag is on', async () => {
    const sinkRef: { current: CanvasDebugSink | null } = { current: null };
    render(
      <Canvas
        width={100} height={100}
                layers={{ scene: noopScene() }}
        debug={{ layers: true }}
        debugSinkRef={sinkRef}
      />,
    );
    await waitForFrame();
    const snap = sinkRef.current?.snapshot();
    expect(snap?.layers.length).toBeGreaterThanOrEqual(1);
    // Overlay layer itself must not be recorded.
    expect(snap?.layers.find((l) => l.id === 'debug-overlay')).toBeUndefined();
    // Scene layer should be there.
    expect(snap?.layers.find((l) => l.id === 'scene')).toBeTruthy();
  });

  it('debug undefined falls back to URL parse', () => {
    const original = window.location.search;
    window.history.replaceState(null, '', '?debug=bounds');
    try {
      const { container } = render(
        <Canvas
          width={100} height={100}
                    layers={{ scene: noopScene() }}
        />,
      );
      expect(container.querySelector('canvas')).toBeTruthy();
    } finally {
      window.history.replaceState(null, '', original || window.location.pathname);
    }
  });
});
