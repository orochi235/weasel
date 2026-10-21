import { act, render } from '@testing-library/react';
import { TrialIdContext } from '@weasel-js/labkit';
import { useContext, useLayoutEffect } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { type CaptureTrials, createRevision, LoupeCaptureContext } from './captureContext';
import { CaptureInputs, LoupeProvider } from './CaptureInputs';
import type { LabConditions } from './conditions';
import { NO_STORY } from './capturePayload';
import { endpoint, hosts, request, settle, shown, stubBitmaps } from './pixels.fixture';
import { RECAPTURE_DEBOUNCE_MS, type PixelsSource } from './pixelsSource';
import { usePixelsSource } from './usePixelsSource';

// jsdom: hit testing and decoding are the fixture's stand-ins, and `data-shown` stands in for the canvas's pixels.

beforeEach(() => {
  stubBitmaps();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const LAB: LabConditions = { labValues: {}, mode: 'light', declarations: {}, modeGlobal: 'mode' };

function Probe({ onSource, onTrials }: { onSource: (s: PixelsSource | null) => void; onTrials: (t: CaptureTrials) => void }) {
  const source = usePixelsSource({ current: LAB });
  const capture = useContext(LoupeCaptureContext);
  useLayoutEffect(() => {
    onSource(source);
    if (capture) onTrials(capture.trials);
  });
  return null;
}

it('keeps the trial published and its last image up while a knob change is recaptured', async () => {
  hosts();
  const { fetch, posts } = endpoint();
  vi.stubGlobal('fetch', fetch);
  const got: { source: PixelsSource | null; trials: CaptureTrials | null } = { source: null, trials: null };
  const entry = { id: 'ui-a--b' };
  const revision = createRevision();
  const tree = (label: string) => (
    <LoupeProvider captureBase="/" revision={revision}>
      <Probe onSource={(s) => (got.source = s)} onTrials={(t) => (got.trials = t)} />
      <TrialIdContext.Provider value="trial-a">
        <CaptureInputs entry={entry} layout="padded" config={{ label }} state={null} />
      </TrialIdContext.Provider>
    </LoupeProvider>
  );
  const { rerender } = render(tree('Go'));
  const slot = document.createElement('div');
  const handle = got.source!.attach(slot, request(50));
  await settle();
  expect(posts.map((p) => p.body.config)).toEqual([{ label: 'Go' }]);
  posts[0]!.answer();
  await settle();
  expect(shown(slot)).toBe(true);

  // Every moment the trial is missing from the registry, a lens would say it shows no story.
  const gaps: boolean[] = [];
  const trials = got.trials!;
  trials.subscribe(() => gaps.push(trials.get('trial-a') === null));
  act(() => rerender(tree('Stop')));
  expect(gaps).not.toContain(true);
  expect(slot.textContent).not.toContain(NO_STORY);
  expect(shown(slot)).toBe(true);

  await act(() => vi.advanceTimersByTimeAsync(RECAPTURE_DEBOUNCE_MS));
  expect(posts.map((p) => p.body.config)).toEqual([{ label: 'Go' }, { label: 'Stop' }]);
  expect(shown(slot)).toBe(true);
  posts[1]!.answer();
  await settle();
  expect(shown(slot)).toBe(true);
  expect(slot.textContent).toBe('');
  handle.detach();
});
