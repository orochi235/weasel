import { renderSettled } from '@weasel-js/react/testing/renderSettled';
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
  );
  const host = container.querySelector<HTMLElement>('.lk-canvas-stack, .lk-stage');
  return host?.dataset.lkTouch;
}

describe('a trial camera’s gestures', () => {
  it('come from the instrument’s canvas or stage', async () => {
    expect(await touchOf(canvas({ pan: false }))).toBe('scroll');
    expect(await touchOf(stage({ pan: false, pinch: false }))).toBe('auto');
  });

  it('are overridden one by one by the lab’s', async () => {
    expect(await touchOf(canvas({ pan: false, pinch: false }), { pinch: true })).toBe('scroll');
    expect(await touchOf(stage(), { pan: false })).toBe('scroll');
  });
});
