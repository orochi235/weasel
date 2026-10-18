import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiagramView, type DiagramViewApi, type EdgeRoute, type NodeMove } from './DiagramView';
import { diagramScene, edgeIdOf, type DiagramData } from './fromData';
import type { Graph } from './graph';
import { layered } from './layered';
import type { LayoutFn } from './layout';
import { diagramLayoutOf } from './sceneSync';

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
    expect(long!.ports).toEqual({ from: 's', to: 'n' });
    // Straight either way, but layout named its ports.
    expect(routes.find((r) => r.id === edgeIdOf({ from: 'a', to: 'b' }))).toEqual({
      id: edgeIdOf({ from: 'a', to: 'b' }), waypoints: [], ports: { from: 's', to: 'n' },
    });

    // Kept as the data edge's waypoints, the route survives being laid into a scene again.
    const kept: DiagramData = {
      ...DATA,
      edges: DATA.edges.map((e) => (edgeIdOf(e) === long!.id ? { ...e, waypoints: long!.waypoints } : e)),
    };
    const again = diagramScene(kept, { layout: 'none' }).find((s) => s.id === (long!.id as never))!;
    expect((again.data as { diagram: { waypoints?: unknown } }).diagram.waypoints).toEqual(long!.waypoints);
  });

  it('reports what a planner answering later laid out, as it reports a built-in layout', async () => {
    const reported = async (algorithm: Parameters<DiagramViewApi['layout']>[0]) => {
      const calls: { moves: readonly NodeMove[]; routes: readonly EdgeRoute[] }[] = [];
      const clock = makeClock();
      const api = createRef<DiagramViewApi>();
      const { unmount } = render(
        <DiagramView
          ref={api} specs={diagramScene(DATA, { layout: 'none' })} width={300} height={300}
          onMove={(moves, routes) => { calls.push({ moves, routes }); }}
          live={{ frames: 2, requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame }}
        />,
      );
      await act(async () => { api.current!.layout(algorithm); });
      await act(async () => { clock.run(); });
      unmount();
      return calls;
    };
    // Across, so an answer read as the default `layered` would show.
    const across: LayoutFn = Object.assign((graph: Graph) => layered(graph, { direction: 'right' }), {
      plan: (graph: Graph) => layered.plan!(graph, { direction: 'right' }),
    });
    const later = await reported({ plan: (graph) => Promise.resolve(across.plan!(graph)) });
    expect(later.flatMap((c) => c.routes).length).toBeGreaterThan(0);
    expect(later).toEqual(await reported(across));
    expect(later).not.toEqual(await reported('layered'));
  });

  it('reports ports a consumer can store without renaming the edge', async () => {
    const calls: EdgeRoute[] = [];
    const clock = makeClock();
    const api = createRef<DiagramViewApi>();
    const specs = diagramScene(DATA, { layout: 'none' });
    const { rerender } = render(
      <DiagramView
        ref={api} specs={specs} width={300} height={300} onMove={(_m, r) => { calls.push(...r); }}
        live={{ frames: 2, requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame }}
      />,
    );
    await act(async () => { api.current!.layout('layered'); });
    await act(async () => { clock.run(); });
    const by = new Map(calls.map((r) => [r.id, r]));
    const kept: DiagramData = {
      ...DATA,
      edges: DATA.edges.map((e) => {
        const r = by.get(edgeIdOf(e));
        return r === undefined ? e : { ...e, routed: r.waypoints, routedPorts: r.ports };
      }),
    };
    const again = diagramScene(kept, { layout: 'none' });
    expect(again.map((s) => s.id)).toEqual(specs.map((s) => s.id));
    const ab = again.find((s) => s.id === (edgeIdOf({ from: 'a', to: 'b' }) as never))!;
    expect((ab.data as { diagram: { from: unknown } }).diagram.from).toEqual({ port: 's', laidOut: 's' });

    calls.length = 0;
    await act(async () => {
      rerender(<DiagramView ref={api} specs={again} width={300} height={300} onMove={(_m, r) => { calls.push(...r); }} />);
    });
    expect(calls).toEqual([]);
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

  it('reports nothing when a host stores what the build laid out and rebuilds', async () => {
    const onMove = vi.fn();
    const first = diagramScene(DATA);
    const { moves, routes } = diagramLayoutOf(first);
    const at = new Map(moves.map((m) => [m.id, { x: m.x, y: m.y }]));
    const by = new Map(routes.map((r) => [r.id, r]));
    const kept: DiagramData = {
      nodes: DATA.nodes.map((n) => ({ ...n, at: at.get(n.id)!, pinned: true })),
      edges: DATA.edges.map((e) => {
        const r = by.get(edgeIdOf(e))!;
        return { ...e, routed: r.waypoints, routedPorts: r.ports };
      }),
    };
    const { rerender } = render(<DiagramView specs={first} width={300} height={300} onMove={onMove} />);
    await act(async () => {
      rerender(<DiagramView specs={diagramScene(kept)} width={300} height={300} onMove={onMove} />);
    });
    expect(onMove).not.toHaveBeenCalled();
  });
});
