import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { makeMatchMedia } from '../../../../core/src/core/device/testing/matchMedia';
import { endpoint, hosts, payload, request, revisions, settle, shown, stubBitmaps } from './pixels.fixture';
import { createPixelsSource } from './pixelsSource';
import type { TrialHit } from './trialAt';

const dprDescriptor = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');

beforeEach(stubBitmaps);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
  if (dprDescriptor) Object.defineProperty(window, 'devicePixelRatio', dprDescriptor);
  else delete (window as { devicePixelRatio?: number }).devicePixelRatio;
});

it("redraws a lens's capture at the display's new density", async () => {
  vi.useFakeTimers();
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
  const media = makeMatchMedia({ '(resolution: 1dppx)': true });
  vi.stubGlobal('matchMedia', media.mm);
  hosts();
  const { fetch, posts } = endpoint();
  const source = createPixelsSource({ base: '/', payloadFor: (hit: TrialHit) => payload(`story-of-${hit.trialId}`), fetch, ...revisions() });
  const slot = document.createElement('div');
  const handle = source.attach(slot, request(50));
  await vi.advanceTimersByTimeAsync(0);
  posts[0]?.answer();
  await settle();
  expect(shown(slot)).toBe(true);
  const canvas = slot.querySelector('canvas');
  expect(canvas?.width).toBe(160);

  // The window moves to a 2x display; the reticle stays where it was.
  Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
  media.fire('(resolution: 1dppx)', false);

  expect(canvas?.width).toBe(320);
  handle.detach();
});
