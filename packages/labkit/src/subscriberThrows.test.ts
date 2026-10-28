import { createClockRegistry } from '@weasel-js/clock';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnnotationStore } from './annotations/store';
import type { CameraView } from './canvas/CameraInput';
import { createCameraRegistry } from './canvas/cameraRegistry';
import { transportHoldOf } from './clock/transportHold';
import { createTrialClock } from './clock/trialClock';
import { createPanelHostRegistry } from './lab/panelHost';

afterEach(() => vi.restoreAllMocks());

/** Subscribes one listener that throws and one after it, and says what `change` did to them. */
function afterAThrow(subscribe: (fn: () => void) => unknown, change: () => void) {
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  const heard = vi.fn();
  subscribe(() => {
    throw new Error('boom');
  });
  subscribe(heard);
  expect(change).not.toThrow();
  expect(heard).toHaveBeenCalledTimes(1);
  expect(logged).toHaveBeenCalledTimes(1);
}

describe('a subscriber that throws does not stop the ones after it', () => {
  it('in a panel host registry', () => {
    const hosts = createPanelHostRegistry();
    afterAThrow(hosts.subscribe, () => hosts.set('a', document.createElement('div')));
  });

  it('in a camera registry', () => {
    const cameras = createCameraRegistry();
    afterAThrow(cameras.subscribe, () => cameras.register('a', {} as CameraView));
  });

  it('in a clock registry', () => {
    const clocks = createClockRegistry();
    afterAThrow(clocks.subscribe, () => clocks.register('a', createTrialClock({})));
  });

  it('in a transport hold', () => {
    const hold = transportHoldOf(createTrialClock({}).clock);
    afterAThrow(hold.subscribe, () => hold.touch());
  });

  it('in a trial clock, for a change', () => {
    const { clock } = createTrialClock({});
    afterAThrow(clock.subscribe, () => clock.seek(10));
  });

  it('in a trial clock, for a wake', () => {
    const { clock } = createTrialClock({});
    clock.sync(0);
    afterAThrow(clock.onWake, () => clock.seek(10));
  });

  it('in a trial clock, for a frame', () => {
    const c = createTrialClock({ rate: 1 });
    c.clock.sync(0);
    afterAThrow(c.onFrame, () => c.clock.sync(16));
  });

  it('in an annotation store', () => {
    const store = createAnnotationStore({
      targets: () => [{ id: 't', content: { w: 10, h: 10 } }],
    });
    afterAThrow(store.subscribe, () =>
      store.add({ target: 't', kind: 'rect', frac: { x: 0, y: 0, w: 0.1, h: 0.1 } }),
    );
  });
});
