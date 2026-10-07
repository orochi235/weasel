/**
 * `gestures` on a camera: each gesture it is told to leave alone neither moves
 * the view nor stops the event reaching the page.
 */

import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { ViewTransform } from '../instrument/types';
import { CanvasStack } from './CanvasStack';
import type { CameraGestures } from './cameraGestures';
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

const OPEN: ViewTransform = { zoom: 1, pan: { x: 0, y: 0 } };

function mountStage(gestures?: CameraGestures) {
  const seen: ViewTransform[] = [];
  function Host() {
    const [view, setView] = useState(OPEN);
    return (
      <Stage
        size={{ width: 100, height: 100 }}
        view={view}
        onViewChange={(v) => {
          seen.push(v);
          setView(v);
        }}
        {...(gestures ? { gestures } : {})}
      >
        <div />
      </Stage>
    );
  }
  const { container } = render(<Host />);
  return { host: container.querySelector('.lk-stage') as HTMLElement, seen };
}

function pointer(el: Element, type: string, id: number, x: number, y: number, buttons = 1) {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: id,
      pointerType: 'touch',
      clientX: x,
      clientY: y,
      button: 0,
      buttons,
    }),
  );
}

function drag(host: Element) {
  act(() => {
    pointer(host, 'pointerdown', 1, 50, 50);
    pointer(host, 'pointermove', 1, 70, 60);
    pointer(host, 'pointermove', 1, 90, 70);
    pointer(host, 'pointerup', 1, 90, 70, 0);
  });
}

function pinchOut(host: Element) {
  act(() => {
    pointer(host, 'pointerdown', 1, 100, 100);
    pointer(host, 'pointerdown', 2, 200, 100);
  });
  act(() => pointer(host, 'pointermove', 2, 300, 100));
}

/** Dispatches a wheel and returns whether the camera claimed it. */
function wheel(host: Element, init: WheelEventInit = {}): boolean {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaY: -100,
    clientX: 40,
    clientY: 30,
    ...init,
  });
  act(() => {
    host.dispatchEvent(event);
  });
  return event.defaultPrevented;
}

describe('camera gestures', () => {
  it('takes every gesture by default', () => {
    const { host, seen } = mountStage();
    expect(wheel(host)).toBe(true);
    drag(host);
    pinchOut(host);
    expect(seen.length).toBeGreaterThan(2);
    expect(host.dataset.lkTouch).toBe('none');
  });

  it('leaves a drag alone with `pan: false`', () => {
    const { host, seen } = mountStage({ pan: false });
    drag(host);
    expect(seen).toEqual([]);
  });

  it('leaves the wheel to the page with `wheel: false`', () => {
    const { host, seen } = mountStage({ wheel: false });
    expect(wheel(host)).toBe(false);
    expect(seen).toEqual([]);
  });

  it('zooms on a modified wheel only with `wheel: "mod"`', () => {
    const { host, seen } = mountStage({ wheel: 'mod', pinch: false });
    expect(wheel(host)).toBe(false);
    expect(seen).toEqual([]);
    // Cmd on a Mac, Ctrl elsewhere: exactly one of the two is the platform's.
    const claimed = [wheel(host, { metaKey: true }), wheel(host, { ctrlKey: true })];
    expect(claimed.filter(Boolean)).toHaveLength(1);
    expect(seen.length).toBe(1);
  });

  it('zooms on a two-finger pinch', () => {
    const { host, seen } = mountStage({ pan: false });
    pinchOut(host);
    expect(seen.at(-1)?.zoom).toBeGreaterThan(1);
  });

  it('leaves a pinch alone with `pinch: false`, trackpad or touch', () => {
    const { host, seen } = mountStage({ pan: false, pinch: false });
    expect(wheel(host, { ctrlKey: true })).toBe(false);
    pinchOut(host);
    expect(seen).toEqual([]);
  });

  it('hands the browser one-finger scrolling once the camera does not pan', () => {
    expect(mountStage({ pan: false }).host.dataset.lkTouch).toBe('scroll');
    expect(mountStage({ pan: false, pinch: false }).host.dataset.lkTouch).toBe('auto');
  });

  it('reports no tap with `tap: false`', () => {
    const onHitTest = vi.fn();
    function Host({ gestures }: { gestures?: CameraGestures }) {
      return (
        <CanvasStack
          layers={[]}
          view={OPEN}
          onViewChange={() => {}}
          onHitTest={onHitTest}
          {...(gestures ? { gestures } : {})}
        />
      );
    }
    const tap = (gestures?: CameraGestures) => {
      const { container, unmount } = render(<Host {...(gestures ? { gestures } : {})} />);
      const host = container.querySelector('.lk-canvas-stack') as HTMLElement;
      act(() => {
        pointer(host, 'pointerdown', 1, 20, 20);
        pointer(host, 'pointerup', 1, 20, 20, 0);
      });
      unmount();
    };
    tap();
    expect(onHitTest).toHaveBeenCalledTimes(1);
    tap({ tap: false });
    expect(onHitTest).toHaveBeenCalledTimes(1);
  });
});
