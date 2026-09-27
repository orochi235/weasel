/**
 * Two cameras under one host scope — what a trial gives every canvas inside it,
 * and what a forge index page puts several of in. Each must answer only for
 * itself: the newest must not take the others' gestures.
 */

import { act, render } from '@testing-library/react';
import { WeaselProvider } from '@weasel-js/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { ViewTransform } from '../instrument/types';
import { CanvasStack } from './CanvasStack';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  proto.hasPointerCapture = vi.fn(() => true);
});

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

const VIEW: ViewTransform = { zoom: 1, pan: { x: 0, y: 0 } };

function mountTwo() {
  const views = [vi.fn(), vi.fn()];
  const taps = [vi.fn(), vi.fn()];
  const { container } = render(
    <WeaselProvider isolate>
        {views.map((onViewChange, i) => (
          <CanvasStack
            key={i}
            layers={[]}
            view={VIEW}
            onViewChange={onViewChange}
            onHitTest={taps[i]}
            width={100}
            height={100}
          />
        ))}
    </WeaselProvider>,
  );
  const hosts = [...container.querySelectorAll<HTMLElement>('.lk-canvas-stack')];
  return { hosts, views, taps };
}

describe('cameras sharing a host scope', () => {
  it('pans the camera the drag began on, not the newest', () => {
    const { hosts, views } = mountTwo();
    act(() => {
      pointer(hosts[0]!, 'pointerdown', 50, 50);
      pointer(hosts[0]!, 'pointermove', 60, 55);
      pointer(hosts[0]!, 'pointermove', 80, 70);
      pointer(hosts[0]!, 'pointerup', 80, 70, 0);
    });
    expect(views[0]).toHaveBeenCalled();
    expect(views[1]).not.toHaveBeenCalled();
  });

  it('reports a tap to the canvas it landed on', () => {
    const { hosts, taps } = mountTwo();
    act(() => {
      pointer(hosts[0]!, 'pointerdown', 50, 50);
      pointer(hosts[0]!, 'pointerup', 50, 50, 0);
    });
    expect(taps[0]).toHaveBeenCalledTimes(1);
    expect(taps[1]).not.toHaveBeenCalled();
  });

  it('still drives the newest camera from its own canvas', () => {
    const { hosts, views } = mountTwo();
    act(() => {
      pointer(hosts[1]!, 'pointerdown', 50, 50);
      pointer(hosts[1]!, 'pointermove', 80, 70);
      pointer(hosts[1]!, 'pointerup', 80, 70, 0);
    });
    expect(views[1]).toHaveBeenCalled();
    expect(views[0]).not.toHaveBeenCalled();
  });
});
