/**
 * An instrument declaring `orbit`: the trial keeps its camera in `view`, so
 * Clone copies it and Reset puts it back, and the camera reads and moves
 * through `useTrialOrbit` and the lab's zoom chrome as a 2D camera does.
 */

import { act, screen } from '@testing-library/react';
import { type Camera3d, createCamera } from '@weasel-js/kernel3d';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useContext } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import type { Instrument } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { LabContext, type LabContextValue } from '../lab/LabContext';
import { LabStoreContext } from '../state/context';
import type { LabStore } from '../state/store';
import { as3DView } from '../state/view';
import { cameraOf } from './homeView';
import { type TrialOrbit, useTrialOrbit } from './useTrialOrbit';

beforeAll(() => {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  proto.hasPointerCapture = vi.fn(() => true);
});

const seen: { lab: LabContextValue | null; store: LabStore | null; orbit: TrialOrbit | null } = {
  lab: null,
  store: null,
  orbit: null,
};

function Readout() {
  const orbit = useTrialOrbit();
  seen.orbit = orbit;
  return <output data-testid="distance">{orbit?.camera?.distance.toFixed(2)}</output>;
}

const Solid = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Solid',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <Readout />,
  orbit: { initialView: { distance: 20, pitch: 0.4 }, limits: { minDistance: 2, maxDistance: 80 } },
});

function Capture() {
  seen.lab = useContext(LabContext);
  seen.store = useContext(LabStoreContext)?.store ?? null;
  return null;
}

async function mount() {
  const out = await renderSettled(
    <Lab instruments={[Solid]} defaultInstrument="Solid">
      <Capture />
    </Lab>,
    { wrapper: withIcons },
  );
  const trialId = () => seen.lab?.trials[0]?.id ?? '';
  const view = (i = 0) => as3DView(seen.store?.getState().trials[i]?.view);
  return { ...out, trialId, view };
}

describe('an orbit trial', () => {
  it('opens on its initialView, held in the trial view as plain numbers', async () => {
    const { view } = await mount();
    expect(view()).toEqual(createCamera({ distance: 20, pitch: 0.4 }));
    expect(screen.getByTestId('distance')).toHaveTextContent('20.00');
  });

  it('dollies on the wheel, and the instrument reads the camera as it moves', async () => {
    const { container, view } = await mount();
    const host = container.querySelector('.lk-orbit') as HTMLElement;
    await act(async () => {
      host.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 200 }));
    });
    expect(view()?.distance).toBeGreaterThan(20);
    expect(seen.orbit?.camera).toEqual(view());
  });

  it('copies the camera on Clone and puts it back on Reset', async () => {
    const { trialId, view } = await mount();
    const turned: Camera3d = { ...createCamera({ distance: 20, pitch: 0.4 }), yaw: 1.5 };
    await act(async () => seen.orbit?.setCamera(turned));
    await act(async () => seen.lab?.cloneTrial(trialId()));
    expect(view(1)).toEqual(turned);
    await act(async () => seen.lab?.resetTrial(trialId()));
    expect(view(0)).toEqual(createCamera({ distance: 20, pitch: 0.4 }));
    expect(view(1)).toEqual(turned);
  });

  it('holds a camera set from outside inside its limits, and goes home', async () => {
    const { view } = await mount();
    await act(async () => seen.orbit?.setCamera(createCamera({ distance: 1000, yaw: 2 })));
    expect(view()?.distance).toBe(80);
    await act(async () => seen.orbit?.home());
    expect(view()).toEqual(createCamera({ distance: 20, pitch: 0.4 }));
  });

  it('drives the lab zoom: the readout, and the steps dollying the camera', async () => {
    const { view } = await mount();
    const readout = () => document.querySelector('.lk-lab-zoom__readout')?.textContent;
    expect(readout()).toBe('100%');
    await act(async () => screen.getByRole('button', { name: 'Zoom in' }).click());
    expect(view()?.distance).toBeCloseTo(16);
    expect(view()?.pitch).toBe(0.4);
    expect(readout()).toBe('125%');
  });
});

describe('cameraOf', () => {
  it('refuses an orbit beside a 2D camera', () => {
    const both = { ...Solid, canvas: { layers: [] } } as unknown as Instrument;
    expect(() => cameraOf(both)).toThrow(/declares `orbit` beside `canvas`/);
  });
});
