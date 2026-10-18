import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { CameraGestures } from '../canvas/cameraGestures';
import type { Instrument } from '../instrument/types';
import { Lab } from './Lab';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

const canvas = (gestures?: CameraGestures): Instrument => ({
  name: 'Canvas',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
  canvas: { layers: [], ...(gestures ? { gestures } : {}) },
});

const stage = (gestures?: CameraGestures): Instrument => ({
  name: 'Stage',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <div />,
  stage: { size: { width: 100, height: 100 }, ...(gestures ? { gestures } : {}) },
});

async function touchOf(instrument: Instrument, gestures?: CameraGestures) {
  const { container } = await renderSettled(
    <Lab
      instruments={[instrument]}
      defaultInstrument={instrument.name}
      {...(gestures ? { gestures } : {})}
    />,
    { wrapper: withIcons },
  );
  const host = container.querySelector<HTMLElement>('.lk-canvas-stack, .lk-stage');
  return host?.dataset.lkTouch;
}

describe('a trial camera’s gestures', () => {
  it('come from the instrument’s canvas or stage', async () => {
    expect(await touchOf(canvas({ drag: false }))).toBe('scroll');
    expect(await touchOf(stage({ drag: false, pinch: false }))).toBe('auto');
  });

  it('are overridden one by one by the lab’s', async () => {
    expect(await touchOf(canvas({ drag: false, pinch: false }), { pinch: true })).toBe('scroll');
    expect(await touchOf(stage(), { drag: false })).toBe('scroll');
  });
});
