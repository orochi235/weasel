import type { ClockRegistry } from '@weasel-js/clock';
import { isDev } from '@weasel-js/react';
import { useEffect, useLayoutEffect, useState } from 'react';
import type { TrialClock, TrialClockHandle } from '../clock/trialClock';

/** A presented lab held still, for a poster to be taken of it. */
export interface Still {
  /** Where its clocks stand, in ms. Omitted, where each one opens. */
  at?: number;
}

/** The still `<Lab still>` asks for, else the one `?still` or `?still=<ms>`
 *  in the page's URL does. */
export function stillOf(prop: boolean | number | undefined): Still | null {
  if (typeof prop === 'number') return { at: prop };
  if (prop === true) return {};
  if (typeof location === 'undefined') return null;
  const params = new URLSearchParams(location.search);
  if (!params.has('still')) return null;
  const text = params.get('still') ?? '';
  const at = Number(text);
  return text !== '' && Number.isFinite(at) ? { at } : {};
}

/** Whether a still at a time reaches it by running `handle`'s clock there. */
const runs = (handle: TrialClockHandle): handle is TrialClockHandle & { step: number } =>
  !handle.clock.seekable && handle.step !== undefined && handle.step > 0;

function holdStill(handle: TrialClockHandle, still: Still): void {
  const { clock } = handle;
  if (clock.rate !== 0) clock.rate = 0;
  if (still.at === undefined || runs(handle)) return;
  if (clock.seekable) clock.seek(still.at);
  else if (isDev())
    console.warn(
      `[labkit] a still at ${still.at}ms leaves a clock that is not seekable where it opens; a \`step\` in its declaration runs it there`,
    );
}

/** Play `clock` forward to `at`, `step` ms a frame, as frames nothing showed. */
function runTo(clock: TrialClock, at: number, step: number): void {
  let now = 0;
  clock.rebase();
  clock.rate = 1;
  clock.sync(now);
  // The count bounds a sum of steps that rounding leaves a hair short of `at`.
  for (let left = Math.ceil((at - clock.elapsed) / step) + 1; left > 0; left--) {
    if (clock.rate === 0 || clock.elapsed >= at) break;
    now += Math.min(step, at - clock.elapsed);
    clock.sync(now);
  }
  clock.rate = 0;
  clock.rebase();
}

/** How many frames a still waits, once its fonts have loaded, before it says
 *  it is ready: one for the clocks' sync, one for the draw the sync asks for,
 *  and one for that draw to reach the screen. */
const SETTLE_FRAMES = 3;

function afterFrames(view: Window, count: number, done: () => void): () => void {
  let id = 0;
  let left = count;
  const step = (): void => {
    if (left-- === 0) done();
    else id = view.requestAnimationFrame(step);
  };
  step();
  return () => view.cancelAnimationFrame(id);
}

/**
 * Hold a lab still: every clock in `clocks` paused at `still.at` as it
 * registers. Answers `'ready'` once what that leaves has been painted, and
 * `'pending'` until then; `null` for a lab that is not a still.
 */
export function useStill(
  still: Still | null,
  clocks: ClockRegistry,
  labBody: HTMLElement | null,
): 'pending' | 'ready' | null {
  useLayoutEffect(() => {
    if (!still) return;
    const held = new WeakSet<TrialClock>();
    const hold = (): void => {
      for (const handle of clocks.all()) {
        const { clock } = handle;
        if (held.has(clock)) continue;
        held.add(clock);
        holdStill(handle, still);
      }
    };
    hold();
    return clocks.subscribe(hold);
  }, [still, clocks]);

  const [ready, setReady] = useState(false);
  const [ran] = useState(() => new WeakSet<TrialClock>());
  useEffect(() => {
    const view = labBody?.ownerDocument.defaultView;
    if (!still || !view) return;
    const { at } = still;
    // Not at registration: a clock's frame listeners attach in effects, and
    // the lab's own clock registers before any trial that plays on it mounts.
    const run = (): void => {
      if (at === undefined) return;
      for (const handle of clocks.all()) {
        if (!runs(handle) || ran.has(handle.clock)) continue;
        ran.add(handle.clock);
        runTo(handle.clock, at, handle.step);
      }
    };
    let cancel = (): void => {};
    let live = true;
    void Promise.resolve(view.document.fonts?.ready).then(() => {
      if (!live) return;
      run();
      const unsubscribe = clocks.subscribe(run);
      const stop = afterFrames(view, SETTLE_FRAMES, () => setReady(true));
      cancel = () => {
        unsubscribe();
        stop();
      };
    });
    return () => {
      live = false;
      cancel();
    };
  }, [still, labBody, clocks, ran]);

  if (!still) return null;
  return ready ? 'ready' : 'pending';
}
