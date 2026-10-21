import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiagramView, type DiagramViewProps } from './DiagramView';
import { createSpecRouter } from './avoid/specRoutes';
import type { DiagramEdge } from './edgeTrait';
import { diagramScene, edgeIdOf, type DiagramData } from './fromData';

afterEach(() => { cleanup(); });

/** a and b side by side: `a -> b` runs along y = 20 from x = 100 to 300. */
const DATA: DiagramData = {
  nodes: [
    { id: 'a', lines: [], width: 100, height: 40, at: { x: 0, y: 0 } },
    { id: 'b', lines: [], width: 100, height: 40, at: { x: 300, y: 0 } },
  ],
  edges: [{ from: 'a', to: 'b', router: 'straight' }],
};
const AB = edgeIdOf(DATA.edges[0]!);
const IDENTITY = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function mount(extra: Partial<DiagramViewProps>, data: DiagramData = DATA) {
  const { container } = render(
    <DiagramView specs={diagramScene(data, { layout: 'none' })} width={500} height={300} view={IDENTITY} onViewChange={() => {}} {...extra} />,
  );
  return container.querySelector('canvas')!;
}

const pointer = (canvas: HTMLCanvasElement, type: string, x: number, y: number) =>
  canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1 }));

const click = (canvas: HTMLCanvasElement, x: number, y: number) => act(() => {
  pointer(canvas, 'pointerdown', x, y);
  pointer(canvas, 'pointerup', x, y);
});

const drag = (canvas: HTMLCanvasElement, from: [number, number], to: [number, number]) => act(() => {
  pointer(canvas, 'pointerdown', ...from);
  pointer(canvas, 'pointermove', (from[0] + to[0]) / 2, (from[1] + to[1]) / 2);
  pointer(canvas, 'pointermove', ...to);
  pointer(canvas, 'pointerup', ...to);
});

describe('DiagramView route editing', () => {
  it('reports a drag off a selected edge\'s leg as its new waypoints, and writes nothing', () => {
    const onEditRoute = vi.fn();
    const onSelect = vi.fn();
    const canvas = mount({ onEditRoute, onSelect });
    click(canvas, 160, 20);
    expect(onSelect).toHaveBeenLastCalledWith(AB);
    drag(canvas, [200, 20], [200, 120]);
    expect(onEditRoute).toHaveBeenCalledTimes(1);
    expect(onEditRoute).toHaveBeenCalledWith({ edge: AB, waypoints: [{ x: 200, y: 120 }] });
    // Reported, not written: the leg's handle is still where it was.
    drag(canvas, [200, 20], [200, 120]);
    expect(onEditRoute).toHaveBeenCalledTimes(2);
  });

  it('reports a double-click on a waypoint as the route without it', () => {
    const onEditRoute = vi.fn();
    const data = { ...DATA, edges: [{ ...DATA.edges[0]!, waypoints: [{ x: 200, y: 100 }] }] };
    const canvas = mount({ onEditRoute }, data);
    click(canvas, 150, 60);
    act(() => {
      for (let i = 0; i < 2; i++) {
        pointer(canvas, 'pointerdown', 200, 100);
        pointer(canvas, 'pointerup', 200, 100);
      }
      canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 200, clientY: 100, detail: 2 }));
    });
    expect(onEditRoute).toHaveBeenCalledWith({ edge: edgeIdOf(data.edges[0]!), waypoints: [] });
  });
});

describe('DiagramView router="avoid"', () => {
  it('draws each edge around the shapes in its way', () => {
    const data: DiagramData = {
      nodes: [...DATA.nodes.map((n) => ({ ...n, at: { x: n.at!.x, y: 100 } })), { id: 'wall', lines: [], width: 40, height: 120, at: { x: 180, y: 60 } }],
      edges: [{ from: 'a', to: 'b' }],
    };
    const specs = diagramScene(data, { layout: 'none' });
    const routed = createSpecRouter()(specs).find((s) => s.id === AB)!;
    const route = (routed.data as { diagram: DiagramEdge }).diagram.route!;
    const run = route.findIndex((p, i) => i > 0 && p.y === route[i - 1]!.y);
    const on = { x: (route[run - 1]!.x + route[run]!.x) / 2, y: route[run]!.y };
    const onSelect = vi.fn();
    const { container } = render(
      <DiagramView specs={specs} router="avoid" pickEdges onSelect={onSelect} width={500} height={300} view={IDENTITY} onViewChange={() => {}} />,
    );
    const canvas = container.querySelector('canvas')!;
    click(canvas, on.x, on.y);
    expect(onSelect).toHaveBeenLastCalledWith(AB);
  });
});
