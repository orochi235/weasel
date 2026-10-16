import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { pathInWorld, pathToAnchors, type Path, type PolygonPath } from '@weasel-js/core';
import { act, StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AnchorFieldsLabDemo } from '../AnchorFieldsLabDemo';

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

const anchorXs = () => {
  const node = window.__weaselTest!.getScene().nodes.find((n) => n.id === 'leaf')!;
  const world = pathInWorld((node.data as { path: Path }).path, node.pose as never) as PolygonPath;
  return pathToAnchors(world).anchors[0].map((a) => Math.round(a.x));
};

function type(name: string, text: string) {
  const field = screen.getByRole('spinbutton', { name });
  act(() => {
    fireEvent.change(field, { target: { value: text } });
    fireEvent.blur(field);
  });
}

describe('AnchorFieldsLabDemo', () => {
  it('reads the two selected anchors as Mixed in X, moves both by +=, and sets both to a typed value', async () => {
    await renderSettled(<StrictMode><AnchorFieldsLabDemo /></StrictMode>);
    expect(screen.getByRole('spinbutton', { name: 'X' })).toHaveAttribute('placeholder', 'Mixed');
    expect(anchorXs()).toEqual([100, 340]);

    type('X', '+=10');
    expect(anchorXs()).toEqual([110, 350]);

    type('X', '1in');
    expect(anchorXs()).toEqual([72, 72]);
    expect(screen.getByRole('spinbutton', { name: 'X' })).toHaveValue('72');
  });
});
