import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { View } from '@weasel-js/core';
import { createRef } from 'react';
import { DiagramView, fitDiagram, type DiagramViewApi } from './DiagramView';
import type { LayoutPlanner } from './layout';
import { diagramScene, type DiagramData } from './fromData';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const DATA: DiagramData = {
  nodes: [{ id: 'a', lines: [], width: 400, height: 40, at: { x: 0, y: 0 } }, { id: 'b', lines: [], width: 40, height: 40, at: { x: 600, y: 0 } }],
  edges: [],
};
const SPECS = diagramScene(DATA, { layout: 'none' });

describe('DiagramView refit', () => {
  it('fits again when its box changes size, while the view is still its fit', async () => {
    const views: View[] = [];
    const onViewChange = (v: View) => views.push(v);
    const { rerender } = render(<DiagramView specs={SPECS} width={800} height={300} onViewChange={onViewChange} />);
    await act(async () => {
      rerender(<DiagramView specs={SPECS} width={300} height={300} onViewChange={onViewChange} />);
    });
    expect(views.at(-1)).toEqual(fitDiagram(SPECS, { width: 300, height: 300 }));
  });

  it('leaves a view the user has moved alone when its box changes size', async () => {
    const views: View[] = [];
    const onViewChange = (v: View) => views.push(v);
    const { rerender, container } = render(<DiagramView specs={SPECS} width={800} height={300} onViewChange={onViewChange} />);
    const canvas = container.querySelector('canvas')!;
    await act(async () => {
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaX: 40, deltaY: 30, bubbles: true, cancelable: true }));
    });
    expect(views.length).toBeGreaterThan(0);
    const panned = views.at(-1)!;
    await act(async () => {
      rerender(<DiagramView specs={SPECS} width={300} height={300} onViewChange={onViewChange} />);
    });
    expect(views.at(-1)).toEqual(panned);
  });

  it('fits again once a layout run settles, while the view is still its fit', async () => {
    for (const panned of [false, true]) {
      const views: View[] = [];
      const clock = makeClock();
      const api = createRef<DiagramViewApi>();
      const { container, unmount } = render(
        <DiagramView
          ref={api} specs={SPECS} width={800} height={300} onViewChange={(v) => views.push(v)}
          live={{ frames: 2, requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame }}
        />,
      );
      if (panned) {
        await act(async () => {
          container.querySelector('canvas')!.dispatchEvent(new WheelEvent('wheel', { deltaX: 40, deltaY: 30, bubbles: true, cancelable: true }));
        });
      }
      const before = views.at(-1);
      await act(async () => { api.current!.layout(FAR); });
      await act(async () => { clock.run(); });
      const moved = diagramScene({ ...DATA, nodes: DATA.nodes.map((n) => (n.id === 'b' ? { ...n, at: { x: 2000, y: 0 } } : n)) }, { layout: 'none' });
      expect(views.at(-1)).toEqual(panned ? before : fitDiagram(moved, { width: 800, height: 300 }));
      unmount();
    }
  });
});

describe('DiagramView refit on new specs', () => {
  const withB = (x: number) =>
    diagramScene({ ...DATA, nodes: DATA.nodes.map((n) => (n.id === 'b' ? { ...n, at: { x, y: 0 } } : n)) }, { layout: 'none' });
  const wheel = (container: HTMLElement) =>
    container.querySelector('canvas')!.dispatchEvent(new WheelEvent('wheel', { deltaX: 40, deltaY: 30, bubbles: true, cancelable: true }));

  it('fits again when new specs run past what the view shows, unless the user moved it', async () => {
    for (const panned of [false, true]) {
      const views: View[] = [];
      const onViewChange = (v: View) => views.push(v);
      const { rerender, container, unmount } = render(<DiagramView specs={SPECS} width={800} height={300} onViewChange={onViewChange} />);
      if (panned) await act(async () => { wheel(container); });
      const before = views.at(-1);
      await act(async () => {
        rerender(<DiagramView specs={withB(2000)} width={800} height={300} onViewChange={onViewChange} />);
      });
      expect(views.at(-1)).toEqual(panned ? before : fitDiagram(withB(2000), { width: 800, height: 300 }));
      unmount();
    }
  });

  it('keeps the view when new specs still fit in it', async () => {
    const views: View[] = [];
    const onViewChange = (v: View) => views.push(v);
    const { rerender } = render(<DiagramView specs={SPECS} width={800} height={300} onViewChange={onViewChange} />);
    const count = views.length;
    await act(async () => {
      rerender(<DiagramView specs={withB(500)} width={800} height={300} onViewChange={onViewChange} />);
    });
    expect(views.length).toBe(count);
  });

  it('fits on fit(), even after the user moved the view', async () => {
    const views: View[] = [];
    const api = createRef<DiagramViewApi>();
    const { container } = render(<DiagramView ref={api} specs={SPECS} width={800} height={300} onViewChange={(v) => views.push(v)} />);
    await act(async () => { wheel(container); });
    expect(views.at(-1)).not.toEqual(fitDiagram(SPECS, { width: 800, height: 300 }));
    await act(async () => { api.current!.fit(); });
    expect(views.at(-1)).toEqual(fitDiagram(SPECS, { width: 800, height: 300 }));
  });
});

describe('DiagramView with no width or height', () => {
  /** jsdom lays nothing out: the canvas's box and its resize reports are stubbed. */
  function stubMeasurement(start: { width: number; height: number }) {
    let box = start;
    const observers: (() => void)[] = [];
    vi.stubGlobal('ResizeObserver', class {
      constructor(private cb: () => void) {}
      observe() { observers.push(this.cb); }
      unobserve() {}
      disconnect() {}
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockImplementation(
      () => ({ x: 0, y: 0, left: 0, top: 0, right: box.width, bottom: box.height, ...box, toJSON() {} }) as DOMRect,
    );
    return (next: { width: number; height: number }) => {
      box = next;
      for (const cb of observers) cb();
    };
  }

  it('opens fitted to the box it fills, and fits again as that box resizes', async () => {
    const resize = stubMeasurement({ width: 800, height: 300 });
    const views: View[] = [];
    await act(async () => {
      render(<DiagramView specs={SPECS} onViewChange={(v) => views.push(v)} />);
    });
    expect(views.at(-1)).toEqual(fitDiagram(SPECS, { width: 800, height: 300 }));
    await act(async () => { resize({ width: 300, height: 300 }); });
    expect(views.at(-1)).toEqual(fitDiagram(SPECS, { width: 300, height: 300 }));
  });

  it('keeps a view the user has moved when the box it fills resizes', async () => {
    const resize = stubMeasurement({ width: 800, height: 300 });
    const views: View[] = [];
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<DiagramView specs={SPECS} onViewChange={(v) => views.push(v)} />));
    });
    await act(async () => {
      container.querySelector('canvas')!.dispatchEvent(new WheelEvent('wheel', { deltaX: 40, deltaY: 30, bubbles: true, cancelable: true }));
    });
    const panned = views.at(-1);
    await act(async () => { resize({ width: 300, height: 300 }); });
    expect(views.at(-1)).toEqual(panned);
  });
});

/** Sends `b` far off to the right. */
const FAR: LayoutPlanner = { plan: () => ({ moves: new Map([['b', { x: 2000, y: 0 }]]) }) };

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
