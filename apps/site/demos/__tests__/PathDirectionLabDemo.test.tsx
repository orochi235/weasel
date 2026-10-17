import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { pathInWorld, pathToAnchors, type Path, type PolygonPath } from '@weasel-js/core';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PathDirectionLabDemo } from '../PathDirectionLabDemo';

// windease lays a lab's tiles out only once something measures them, and
// jsdom ships no ResizeObserver.
beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
  if (typeof globalThis.ResizeObserver !== 'undefined') return;
  globalThis.ResizeObserver = class {
    #cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.#cb = cb;
    }
    observe(target: Element) {
      this.#cb([{ target, contentRect: { width: 800, height: 600, x: 0, y: 0, top: 0, left: 0 } } as ResizeObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

function ring() {
  const node = window.__weaselTest!.getScene().nodes.find((n) => n.id === 'ring')!;
  const data = node.data as { path: Path; vertexColors: number[] };
  const anchors = pathToAnchors(pathInWorld(data.path, node.pose as never) as PolygonPath).anchors[0];
  return { start: [Math.round(anchors[0].x), Math.round(anchors[0].y)], colors: data.vertexColors };
}

describe('PathDirectionLabDemo', () => {
  it('makes the selected anchor the start, its color going with it, and reverses the ring', async () => {
    await renderSettled(<StrictMode><PathDirectionLabDemo /></StrictMode>);
    const before = ring();
    expect(before.start).toEqual([200, 60]);

    await userEvent.click(screen.getByRole('button', { name: 'Make start point' }));
    const started = ring();
    expect(started.start).toEqual([253, 223]);
    expect(started.colors.slice(0, 4)).toEqual(before.colors.slice(8, 12));

    await userEvent.click(screen.getByRole('button', { name: 'Reverse path direction' }));
    const reversed = ring();
    expect(reversed.start).toEqual([253, 223]);
    // Reversed from the same start, the anchor after it is the one that came before.
    expect(reversed.colors.slice(4, 8)).toEqual(before.colors.slice(4, 8));
  });
});
