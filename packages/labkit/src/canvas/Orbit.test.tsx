/**
 * `<Orbit>`: the 3D camera's gestures reach the camera through the dispatcher,
 * inside its limits, and each one it is told to leave alone reaches the page.
 */

import { act, render } from '@testing-library/react';
import { type Camera3d, createCamera } from '@weasel-js/kernel3d';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { CameraView } from './CameraInput';
import type { CameraGestures } from './cameraGestures';
import { CameraPublishContext } from './cameraRegistry';
import { Orbit, type OrbitProps } from './Orbit';

beforeAll(() => {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  proto.hasPointerCapture = vi.fn(() => true);
});

const OPEN = createCamera({ distance: 10, yaw: 0.2, pitch: 0.3 });
const HOME = createCamera({ distance: 10 });

function mount(gestures?: CameraGestures, extra: Partial<OrbitProps> = {}) {
  const seen: Camera3d[] = [];
  const published: CameraView[] = [];
  function Host() {
    const [view, setView] = useState(OPEN);
    return (
      <Orbit
        view={view}
        onViewChange={(v) => {
          seen.push(v);
          setView(v);
        }}
        home={() => HOME}
        {...(gestures ? { gestures } : {})}
        {...extra}
      >
        <div />
      </Orbit>
    );
  }
  const { container } = render(
    <CameraPublishContext.Provider
      value={(camera) => {
        published.push(camera);
        return () => {};
      }}
    >
      <Host />
    </CameraPublishContext.Provider>,
  );
  const host = container.querySelector('.lk-orbit') as HTMLElement;
  return { host, seen, last: () => seen.at(-1), published };
}

function pointer(el: Element, type: string, x: number, y: number, init: PointerEventInit = {}) {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
      clientX: x,
      clientY: y,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      ...init,
    }),
  );
}

function drag(host: Element, init: PointerEventInit = {}) {
  act(() => {
    pointer(host, 'pointerdown', 50, 50, init);
    pointer(host, 'pointermove', 70, 60, init);
    pointer(host, 'pointermove', 90, 70, init);
    pointer(host, 'pointerup', 90, 70, init);
  });
}

/** Dispatches a wheel and returns whether the camera claimed it. */
function wheel(host: Element, init: WheelEventInit = {}): boolean {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100, ...init });
  act(() => {
    host.dispatchEvent(event);
  });
  return event.defaultPrevented;
}

describe('<Orbit>', () => {
  it('turns on a drag, from the camera the drag began on', () => {
    const { host, last } = mount();
    drag(host);
    expect(last()?.yaw).toBeLessThan(OPEN.yaw);
    expect(last()?.pitch).toBeGreaterThan(OPEN.pitch);
    expect(last()?.distance).toBe(OPEN.distance);
    expect(last()?.target).toEqual(OPEN.target);
  });

  it('pans the target on a Shift+drag, leaving the angles', () => {
    const { host, last } = mount();
    drag(host, { shiftKey: true });
    expect(last()?.yaw).toBe(OPEN.yaw);
    expect(last()?.target).not.toEqual(OPEN.target);
  });

  it('dollies on the wheel and on a trackpad pinch, and claims both', () => {
    const { host, last } = mount();
    expect(wheel(host)).toBe(true);
    const out = last()?.distance ?? 0;
    expect(out).toBeGreaterThan(OPEN.distance);
    expect(wheel(host, { ctrlKey: true, deltaY: -100 })).toBe(true);
    expect(last()?.distance).toBeLessThan(out);
  });

  it('holds the distance inside its limits', () => {
    const { host, last } = mount(undefined, { limits: { maxDistance: 11 } });
    for (let i = 0; i < 10; i++) wheel(host);
    expect(last()?.distance).toBe(11);
  });

  it('goes home on a double click', () => {
    const { host, last } = mount();
    act(() => {
      pointer(host, 'pointerdown', 50, 50);
      pointer(host, 'pointerup', 50, 50);
      pointer(host, 'pointerdown', 50, 50);
      pointer(host, 'pointerup', 50, 50);
    });
    expect(last()).toEqual(HOME);
  });

  it('leaves the page what it is told not to take', () => {
    const { host, seen } = mount({ drag: false, wheel: false, pinch: false, home: false });
    expect(wheel(host)).toBe(false);
    drag(host);
    expect(seen).toEqual([]);
    expect(host.dataset.lkTouch).toBe('auto');
  });

  it('keeps the trackpad pinch when told to leave every press alone', () => {
    const { host, seen } = mount({ drag: false, home: false, pinch: 'trackpad' });
    expect(wheel(host, { ctrlKey: true })).toBe(true);
    expect(seen).toHaveLength(1);
    drag(host);
    expect(seen).toHaveLength(1);
    expect(host.dataset.lkTouch).toBe('auto');
  });

  it('takes its gestures on the viewport it is given, and leaves the rest of its element', () => {
    const seen: Camera3d[] = [];
    function Host() {
      const [view, setView] = useState(OPEN);
      const [pane, setPane] = useState<HTMLElement | null>(null);
      return (
        <Orbit
          view={view}
          onViewChange={(v) => {
            seen.push(v);
            setView(v);
          }}
          viewport={pane}
        >
          <div data-testid="toolbar" />
          <div data-testid="pane" ref={setPane} />
        </Orbit>
      );
    }
    const { container } = render(<Host />);
    const toolbar = container.querySelector('[data-testid=toolbar]') as HTMLElement;
    const pane = container.querySelector('[data-testid=pane]') as HTMLElement;
    expect(wheel(toolbar)).toBe(false);
    expect(seen).toEqual([]);
    expect(wheel(pane)).toBe(true);
    expect(seen).toHaveLength(1);
    expect(pane.dataset.lkTouch).toBe('none');
    expect((container.querySelector('.lk-orbit') as HTMLElement).dataset.lkTouch).toBeUndefined();
  });

  it('publishes itself as a zoom the lab chrome can read and drive', () => {
    const { published, last } = mount();
    const camera = published.at(-1) as CameraView;
    expect(camera.zoomOf(OPEN)).toBeCloseTo(1);
    expect(camera.zoomOf({ zoom: 1, pan: { x: 0, y: 0 } })).toBeNull();
    act(() => camera.set({ x: 0, y: 0, scale: { x: 2, y: 2 } }));
    expect(last()?.distance).toBeCloseTo(5);
    expect(last()?.yaw).toBe(OPEN.yaw);
    expect(camera.zoomRange()).toEqual({ min: 10 / 500, max: 10 / 0.5 });
  });
});
