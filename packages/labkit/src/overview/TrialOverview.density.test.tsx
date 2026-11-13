import { act } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { makeMatchMedia } from '../../../core/src/core/device/testing/matchMedia';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';
import { TrialOverview } from './TrialOverview';

const dprDescriptor = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');

beforeAll(() => {
  // A 2D context that takes every call, so the overview sizes and paints its canvases.
  const ctx = new Proxy({}, { get: () => () => {} });
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ctx,
  ) as unknown as HTMLCanvasElement['getContext'];
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (dprDescriptor) Object.defineProperty(window, 'devicePixelRatio', dprDescriptor);
  else delete (window as { devicePixelRatio?: number }).devicePixelRatio;
});

it("resizes the overview's canvases when the display's density changes", async () => {
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
  const media = makeMatchMedia({
    '(pointer: coarse)': false,
    '(hover: hover)': true,
    '(resolution: 1dppx)': true,
  });
  vi.stubGlobal('matchMedia', media.mm);
  const pictured = defineInstrument<Record<string, never>, Record<string, never>>({
    name: 'Pictured',
    initialState: () => ({}),
    render: () => <div />,
    stage: {
      size: { width: 400, height: 300 },
      overlay: () => <TrialOverview width={200} height={150} render={() => <div />} />,
    },
  });
  const r = await renderSettled(<Lab instruments={[pictured]} />, {
    wrapper: withIcons,
  });
  const chrome = r.container.querySelector<HTMLCanvasElement>('.lk-overview__chrome');
  if (!chrome) throw new Error('no overview chrome');
  expect(chrome.width).toBe(200);

  // The window moves to a 2x display; neither the pointer nor the camera moves.
  Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
  await act(async () => media.fire('(resolution: 1dppx)', false));

  expect(chrome.width).toBe(400);
});
