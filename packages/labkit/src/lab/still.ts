import { useEffect, useLayoutEffect, useState } from 'react';
import type { ClockRegistry } from '../clock/clockRegistry';
import type { TrialClock } from '../clock/trialClock';

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

function holdStill(clock: TrialClock, still: Still): void {
  if (clock.rate !== 0) clock.rate = 0;
  if (still.at === undefined) return;
  if (clock.seekable) clock.seek(still.at);
  else if (process.env.NODE_ENV !== 'production')
    console.warn(
      `[labkit] a still at ${still.at}ms leaves a clock that is not seekable where it opens`,
    );
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
      for (const { clock } of clocks.all()) {
        if (held.has(clock)) continue;
        held.add(clock);
        holdStill(clock, still);
      }
    };
    hold();
    return clocks.subscribe(hold);
  }, [still, clocks]);

  const [ready, setReady] = useState(false);
  useEffect(() => {
    const view = labBody?.ownerDocument.defaultView;
    if (!still || !view) return;
    let cancel = (): void => {};
    let live = true;
    void Promise.resolve(view.document.fonts?.ready).then(() => {
      if (live) cancel = afterFrames(view, SETTLE_FRAMES, () => setReady(true));
    });
    return () => {
      live = false;
      cancel();
    };
  }, [still, labBody]);

  if (!still) return null;
  return ready ? 'ready' : 'pending';
}
