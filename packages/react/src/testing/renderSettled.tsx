import type { ReactElement } from 'react';
import { act, type RenderOptions, type RenderResult, render } from '@testing-library/react';

/**
 * `render`, inside an async `act` that also covers the microtasks the mount queued. A
 * component reading an external store that publishes on a microtask — every windease
 * container does — re-renders there, after a plain `render` has already left `act`.
 * Animation frames wait until it returns, as in {@link actSettled}.
 */
export async function renderSettled(ui: ReactElement, options?: RenderOptions): Promise<RenderResult> {
  let result!: RenderResult;
  await actSettled(async () => {
    result = render(ui, options);
  });
  return result;
}

/**
 * An async `act` that holds every animation frame due while it runs, then runs them in a
 * sync `act` once it is done. React's async `act` returns only after a turn of the event
 * loop finds no update queued, and a tree that re-renders on every frame — a playing
 * clock's transport — leaves none whenever a render takes longer than a frame, as it
 * does on a loaded machine; the `act` then never returns.
 */
export async function actSettled(fn: () => Promise<unknown> | void): Promise<void> {
  const release = holdFrames();
  try {
    await act(async () => {
      await fn();
    });
  } finally {
    release();
  }
}

type Frames = Pick<typeof globalThis, 'requestAnimationFrame' | 'cancelAnimationFrame'>;

let holding = false;

/** Defers the callback of every frame requested from now on until the returned release runs. */
function holdFrames(): () => void {
  const scope = globalThis as Partial<Frames>;
  const { requestAnimationFrame: request, cancelAnimationFrame: cancel } = scope;
  if (holding || typeof request !== 'function' || typeof cancel !== 'function') return () => {};
  holding = true;
  let held = true;
  const due: { id: number; run: () => void }[] = [];
  const canceled = new Set<number>();
  scope.requestAnimationFrame = (callback) => {
    const id = request.call(scope, (time) => {
      if (held) due.push({ id, run: () => callback(time) });
      else callback(time);
    });
    return id;
  };
  scope.cancelAnimationFrame = (id) => {
    canceled.add(id);
    cancel.call(scope, id);
  };
  return () => {
    scope.requestAnimationFrame = request;
    scope.cancelAnimationFrame = cancel;
    holding = held = false;
    const runs = due.filter((frame) => !canceled.has(frame.id));
    if (runs.length > 0) act(() => runs.forEach((frame) => frame.run()));
  };
}
