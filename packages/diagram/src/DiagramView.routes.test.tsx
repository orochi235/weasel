import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiagramView, type DiagramViewApi, type EdgeRoute, type NodeMove } from './DiagramView';
import { diagramScene, edgeIdOf, type DiagramData } from './fromData';

afterEach(() => { cleanup(); });

/** `a -> c` skips a rank, so `layered` gives it waypoints. */
const DATA: DiagramData = {
  nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }, { id: 'c', lines: ['c'] }],
  edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'a', to: 'c' }],
};

function makeClock() {
  const callbacks = new Map<number, (t: number) => void>();
  let next = 1;
  return {
    requestFrame: (cb: (t: number) => void) => { callbacks.set(next, cb); return next++; },
    cancelFrame: (h: number) => { callbacks.delete(h); },
    run() {
      for (let i = 0; i < 50 && callbacks.size > 0; i++) {
        const due = [...callbacks.values()];
        callbacks.clear();
        for (const cb of due) cb(0);
      }
    },
  };
}

describe('DiagramView onMove routes', () => {
  it('reports the routes a layout run wrote, so they can be kept in the data', async () => {
    const calls: { moves: readonly NodeMove[]; routes: readonly EdgeRoute[] }[] = [];
    const onMove = vi.fn((moves: readonly NodeMove[], routes: readonly EdgeRoute[]) => { calls.push({ moves, routes }); });
    const clock = makeClock();
    const api = createRef<DiagramViewApi>();
    const specs = diagramScene(DATA, { layout: 'none' });
    render(
      <DiagramView
        ref={api} specs={specs} width={300} height={300} onMove={onMove}
        live={{ frames: 2, requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame }}
      />,
    );
    await act(async () => { api.current!.layout('layered'); });
    await act(async () => { clock.run(); });

    const routes = calls.flatMap((c) => c.routes);
    const long = routes.find((r) => r.id === edgeIdOf({ from: 'a', to: 'c' }));
    expect(long).toBeDefined();
    expect(long!.waypoints.length).toBeGreaterThan(0);
    expect(routes.some((r) => r.id === edgeIdOf({ from: 'a', to: 'b' }))).toBe(false);

    // Kept as the data edge's waypoints, the route survives being laid into a scene again.
    const kept: DiagramData = {
      ...DATA,
      edges: DATA.edges.map((e) => (edgeIdOf(e) === long!.id ? { ...e, waypoints: long!.waypoints } : e)),
    };
    const again = diagramScene(kept, { layout: 'none' }).find((s) => s.id === (long!.id as never))!;
    expect((again.data as { diagram: { waypoints?: unknown } }).diagram.waypoints).toEqual(long!.waypoints);
  });

  it('reports no routes for a reconciled spec change', async () => {
    const onMove = vi.fn();
    const laid = diagramScene(DATA);
    const { rerender } = render(<DiagramView specs={diagramScene(DATA, { layout: 'none' })} width={300} height={300} onMove={onMove} />);
    await act(async () => {
      rerender(<DiagramView specs={laid} width={300} height={300} onMove={onMove} />);
    });
    expect(onMove).not.toHaveBeenCalled();
  });
});
