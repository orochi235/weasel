/**
 * `useOrbitView` is how a 3D view joins its trial's camera, and how the trial
 * learns that it draws one: a trial drawing 3D through no `orbit` warns.
 */

import { act } from '@testing-library/react';
import { createCamera } from '@weasel-js/kernel3d';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useContext } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import type { Instrument, OrbitCapability } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { LabContext, type LabContextValue } from '../lab/LabContext';
import { LabStoreContext } from '../state/context';
import type { LabStore } from '../state/store';
import { as3DView } from '../state/view';
import type { TrialOrbit } from './useTrialOrbit';
import { useOrbitView } from './useOrbitView';

beforeAll(() => {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  proto.hasPointerCapture = vi.fn(() => true);
});

const seen: { lab: LabContextValue | null; store: LabStore | null; view: TrialOrbit | null } = {
  lab: null,
  store: null,
  view: null,
};

function Scene3d() {
  const view = useOrbitView();
  seen.view = view;
  return <div className="scene3d" ref={view.viewportRef} />;
}

function solid(
  name: string,
  orbit?: OrbitCapability<Record<string, never>, Record<string, never>>,
): Instrument {
  return defineInstrument<Record<string, never>, Record<string, never>>({
    name,
    defaultConfig: () => ({}),
    initialState: () => ({}),
    render: () => <Scene3d />,
    ...(orbit ? { orbit } : {}),
  }) as Instrument;
}

function Capture() {
  seen.lab = useContext(LabContext);
  seen.store = useContext(LabStoreContext)?.store ?? null;
  return null;
}

async function mount(instrument: Instrument) {
  const out = await renderSettled(
    <Lab instruments={[instrument]} defaultInstrument={instrument.name}>
      <Capture />
    </Lab>,
    { wrapper: withIcons },
  );
  const view = () => as3DView(seen.store?.getState().trials[0]?.view);
  return { ...out, view };
}

let warn: MockInstance<typeof console.warn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

const cameraWarnings = () =>
  warn.mock.calls.filter((call) => String(call[0]).includes('draws a 3D view'));

describe('useOrbitView', () => {
  it("hands a 3D view its trial's orbit camera, and says nothing", async () => {
    const { view } = await mount(solid('Orbited', { initialView: { distance: 20 } }));
    expect(seen.view?.camera).toEqual(createCamera({ distance: 20 }));
    expect(seen.view?.camera).toEqual(view());
    expect(cameraWarnings()).toEqual([]);
  });

  it('lands the camera gestures on the pane it is attached to', async () => {
    const { container, view } = await mount(solid('Paned', { initialView: { distance: 20 } }));
    const pane = container.querySelector('.scene3d') as HTMLElement;
    await act(async () => {
      pane.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 200 }));
    });
    expect(view()?.distance).toBeGreaterThan(20);
  });

  it('warns once per instrument when its trials draw 3D with no orbit camera', async () => {
    const bare = solid('Bare');
    await mount(bare);
    await act(async () => seen.lab?.cloneTrial(seen.lab.trials[0]?.id ?? ''));
    expect(cameraWarnings()).toHaveLength(1);
    expect(String(cameraWarnings()[0]?.[0])).toMatch(
      /instrument "Bare" draws a 3D view .* declares no `orbit`.*`orbit: \{ fixed: true \}`/,
    );
    expect(seen.view?.camera).toBeNull();
  });

  it('is inert outside a trial', async () => {
    await renderSettled(<Scene3d />);
    expect(seen.view?.camera).toBeNull();
    expect(() => seen.view?.home()).not.toThrow();
    expect(cameraWarnings()).toEqual([]);
  });
});

describe('a fixed orbit', () => {
  it('takes no gestures, keeps its camera readable, and says nothing', async () => {
    const { container, view } = await mount(
      solid('Still', { initialView: { distance: 20 }, fixed: true }),
    );
    const pane = container.querySelector('.scene3d') as HTMLElement;
    await act(async () => {
      pane.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 200 }));
      pane.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    });
    expect(view()?.distance).toBe(20);
    expect(seen.view?.camera?.distance).toBe(20);
    expect(cameraWarnings()).toEqual([]);
  });
});
