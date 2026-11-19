/** A one-shot timer pair, as `AudioEngineOptions.setTimer` takes it, whose
 *  timers fire only when a test calls `fire`. Each `setTimer` gets a handle of
 *  its own, so clearing one timer leaves every other armed. */
export function fakeTimers() {
  const armed = new Map<number, () => void>();
  let nextId = 0;
  return {
    armed,
    setTimer: (cb: () => void): number => { nextId += 1; armed.set(nextId, cb); return nextId; },
    clearTimer: (handle: unknown): void => { armed.delete(handle as number); },
    /** Run every timer armed now, once. One a callback arms waits for the next
     *  `fire`; one a callback clears does not run. */
    fire(): void {
      for (const [id, cb] of [...armed]) {
        if (!armed.delete(id)) continue;
        cb();
      }
    },
  };
}
