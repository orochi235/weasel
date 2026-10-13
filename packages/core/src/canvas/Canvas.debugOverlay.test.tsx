import { describe, expect, it, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from './Canvas';
import type { CanvasDebugSink } from '../debug/types';
import { stubCanvasContext, waitForFrame } from './testing/stubCanvasContext';

beforeAll(stubCanvasContext);

describe('Canvas debug overlay', () => {
  function noopScene() {
    return { drawOne: () => [] } as const;
  }

  function withSearch(search: string, body: () => void) {
    const original = window.location.search;
    window.history.replaceState(null, '', search);
    try {
      body();
    } finally {
      window.history.replaceState(null, '', original || window.location.pathname);
    }
  }

  it('debug={false} builds no debug sink even when the URL has ?debug=all', () => {
    withSearch('?debug=all', () => {
      const sinkRef: { current: CanvasDebugSink | null } = { current: null };
      const { container } = render(
        <Canvas
          width={100} height={100}
          layers={{ scene: noopScene() }}
          debug={false}
          debugSinkRef={sinkRef}
        />,
      );
      expect(container.querySelector('canvas')).toBeTruthy();
      expect(sinkRef.current).toBeNull();
    });
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

  it('builds a debug sink from the URL when debug is undefined, and none without the flag', () => {
    const sinkRef: { current: CanvasDebugSink | null } = { current: null };
    const mount = () => render(
      <Canvas width={100} height={100} layers={{ scene: noopScene() }} debugSinkRef={sinkRef} />,
    );
    withSearch('', () => {
      mount().unmount();
      expect(sinkRef.current).toBeNull();
    });
    withSearch('?debug=bounds', () => {
      mount();
      expect(sinkRef.current).not.toBeNull();
    });
  });
});
