/**
 * A labkit camera on weasel's dispatcher: drag pans by the screen delta, the
 * zoom range holds with the opening zoom kept reachable, and the pointer is
 * published in the instrument's world.
 */

import { act, render } from '@testing-library/react';
import { createPointerStore, PointerContextProvider } from '@weasel-js/core';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { ViewTransform } from '../instrument/types';
import { CanvasStack } from './CanvasStack';
import { Stage } from './Stage';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  proto.hasPointerCapture = vi.fn(() => true);
});

function lastOf<T>(list: readonly T[]): T {
  const item = list[list.length - 1];
  if (item === undefined) throw new Error('nothing recorded');
  return item;
}

function pointer(el: Element, type: string, x: number, y: number, buttons = 1) {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      clientX: x,
      clientY: y,
      button: 0,
      buttons,
    }),
  );
}

function mountStage(initial: ViewTransform, opts: { minZoom?: number; maxZoom?: number } = {}) {
  const seen: ViewTransform[] = [];
  function Host() {
    const [view, setView] = useState(initial);
    return (
      <Stage
        size={{ width: 100, height: 100 }}
        view={view}
        onViewChange={(v) => {
          seen.push(v);
          setView(v);
        }}
        {...opts}
      >
        <div />
      </Stage>
    );
  }
  const { container } = render(<Host />);
  const host = container.querySelector('.lk-stage') as HTMLElement;
  return { host, seen };
}

describe('camera input', () => {
  it('pans by the screen delta of a drag', () => {
    const { host, seen } = mountStage({ zoom: 2, pan: { x: 10, y: 20 } });
    act(() => {
      pointer(host, 'pointerdown', 50, 50);
      pointer(host, 'pointermove', 60, 55);
      pointer(host, 'pointermove', 80, 70);
      pointer(host, 'pointerup', 80, 70, 0);
    });
    const last = lastOf(seen);
    expect(last.zoom).toBeCloseTo(2);
    expect(last.pan.x).toBeCloseTo(40);
    expect(last.pan.y).toBeCloseTo(40);
  });

  it('stops the zoom at the bound, anchored on the pointer', () => {
    const { host, seen } = mountStage({ zoom: 1, pan: { x: 0, y: 0 } }, { maxZoom: 1.2 });
    act(() => {
      host.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaY: -2000,
          clientX: 40,
          clientY: 30,
        }),
      );
    });
    const last = lastOf(seen);
    expect(last.zoom).toBeCloseTo(1.2);
    // The world point under (40, 30) stayed there.
    expect((40 - last.pan.x) / last.zoom).toBeCloseTo(40);
    expect((30 - last.pan.y) / last.zoom).toBeCloseTo(30);
  });

  it('keeps the opening zoom reachable past a narrower range', () => {
    const { host, seen } = mountStage({ zoom: 4, pan: { x: 0, y: 0 } }, { maxZoom: 2 });
    act(() => {
      host.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaY: 100,
          clientX: 0,
          clientY: 0,
        }),
      );
    });
    // Zooming out from 4 lands between 2 and 4, not snapped to 2.
    expect(lastOf(seen).zoom).toBeGreaterThan(2);
  });

  it("publishes the pointer in the instrument's world as the stage", () => {
    const store = createPointerStore();
    const { container } = render(
      <PointerContextProvider store={store}>
        <CanvasStack
          layers={[]}
          view={{ zoom: 2, pan: { x: 0, y: 0 } }}
          onViewChange={() => {}}
          worldSpec={{ yAxis: 'up' }}
        />
      </PointerContextProvider>,
    );
    const host = container.querySelector('.lk-canvas-stack') as HTMLElement;
    act(() => pointer(host, 'pointermove', 40, 30, 0));
    expect(store.get()).toEqual({ worldX: 20, worldY: -15, viewId: 'stage' });
  });
});
