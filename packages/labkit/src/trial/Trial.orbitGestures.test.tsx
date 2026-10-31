/**
 * An orbit trial's camera gestures, and a 2D scene canvas drawn inside the
 * trial beside the 3D view's pane — a node diagram under it, say. Each
 * answers for its own element: the canvas never sees the orbit's bindings, so
 * nothing reports a route conflict and a drag on the canvas leaves the camera
 * alone.
 */

import { act } from '@testing-library/react';
import { createScene, SceneCanvas } from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useContext } from 'react';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';
import { LabStoreContext } from '../state/context';
import type { LabStore } from '../state/store';
import { as3DView } from '../state/view';
import { useTrialOrbit } from './useTrialOrbit';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  proto.hasPointerCapture = vi.fn(() => true);
});

let warn: MockInstance;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn');
});
afterEach(() => warn.mockRestore());

const conflicts = () =>
  warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('route conflict'));

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

function drag(el: Element) {
  pointer(el, 'pointerdown', 50, 50);
  pointer(el, 'pointermove', 60, 55);
  pointer(el, 'pointermove', 90, 70);
  pointer(el, 'pointerup', 90, 70, 0);
}

type Pose = { x: number; y: number; width: number; height: number };
const diagram = createScene<{ kind: 'rect' }, 'main', Pose>({ systemLayers: [{ id: 'main' }] });

function Body({ withCanvas }: { withCanvas: boolean }) {
  const orbit = useTrialOrbit();
  return (
    <>
      <div className="lk-test-pane" ref={orbit?.viewportRef} />
      {withCanvas ? (
        <div className="lk-test-diagram">
          <SceneCanvas scene={diagram} viewport={{}} width={200} height={100} />
        </div>
      ) : null}
    </>
  );
}

const orbitOnly = (withCanvas: boolean) =>
  defineInstrument<Record<string, never>, Record<string, never>>({
    name: withCanvas ? 'WithCanvas' : 'Bare',
    defaultConfig: () => ({}),
    initialState: () => ({}),
    orbit: {
      initialView: { distance: 20, pitch: 0.4 },
      limits: { minDistance: 2, maxDistance: 80 },
    },
    render: () => <Body withCanvas={withCanvas} />,
  });

let store: LabStore | null = null;
function Capture() {
  store = useContext(LabStoreContext)?.store ?? null;
  return null;
}

async function mount(withCanvas: boolean) {
  const instrument = orbitOnly(withCanvas);
  const out = await renderSettled(
    <Lab instruments={[instrument]} defaultInstrument={instrument.name}>
      <Capture />
    </Lab>,
    { wrapper: withIcons },
  );
  const view = () => as3DView(store?.getState().trials[0]?.view);
  const orbitHost = out.container.querySelector('.lk-test-pane') as HTMLElement;
  return { ...out, view, orbitHost };
}

describe('an orbit-only trial', () => {
  it('reports no route conflict, orbits on a drag, and dollies on the wheel', async () => {
    const { view, orbitHost } = await mount(false);
    expect(conflicts()).toEqual([]);
    const before = view()!;
    act(() => drag(orbitHost));
    expect(view()!.yaw).not.toBe(before.yaw);
    await act(async () => {
      orbitHost.dispatchEvent(
        new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 200 }),
      );
    });
    expect(view()!.distance).toBeGreaterThan(before.distance);
  });

  it('keeps a scene canvas inside it out of the camera’s gestures', async () => {
    const { view, orbitHost, container } = await mount(true);
    expect(conflicts()).toEqual([]);
    const canvas = container.querySelector('.lk-test-diagram canvas') as HTMLElement;
    const before = view()!;
    act(() => drag(canvas));
    await act(async () => {
      canvas.dispatchEvent(
        new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 200 }),
      );
    });
    expect(view()).toEqual(before);
    act(() => drag(orbitHost));
    expect(view()!.yaw).not.toBe(before.yaw);
  });
});
