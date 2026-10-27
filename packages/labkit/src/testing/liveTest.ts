import { it as base } from 'vitest';

declare module 'vitest' {
  interface TaskMeta {
    /** Where each step a timed-out attempt was still awaiting was taken. */
    waitingOn?: string[];
  }
}

/** Wraps a test's step so it refuses to run, or to resume the test, once that test has ended. */
export type Live = <A extends unknown[], R>(step: (...args: A) => R) => (...args: A) => R;

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof (value as PromiseLike<unknown> | null)?.then === 'function';

// A test that times out keeps running once vitest has moved on, and a step it took then
// would act on the next test's lab, or its own retry's. Not by the test's `signal`:
// vitest 5.0.2 hands a retry the one that already aborted.
/** vitest's `it` with a `live` fixture: steps wrapped in it throw once their test has
 *  ended, and a test that ends mid-step (a timeout) records where each such step was taken. */
export const it = base.extend<{ live: Live }>({
  live: async ({ task }, provide) => {
    let ended = false;
    const check = (): void => {
      if (ended) throw new Error('this test has already ended');
    };
    const waiting = new Set<Error>();
    const live: Live =
      (step) =>
      (...args) => {
        check();
        const result = step(...args);
        if (!isThenable(result)) return result;
        const at = new Error(step.name || 'a step');
        waiting.add(at);
        return Promise.resolve(result).then(
          (value) => {
            waiting.delete(at);
            check();
            return value;
          },
          (error: unknown) => {
            waiting.delete(at);
            throw error;
          },
        ) as unknown as typeof result;
      };
    await provide(live);
    ended = true;
    // The timeout reporter (`scripts/vitest-timeout-retries.ts`) prints these beside the test.
    if (waiting.size > 0) {
      task.meta.waitingOn = [
        ...(task.meta.waitingOn ?? []),
        ...[...waiting].map((at) => at.stack ?? at.message),
      ];
    }
  },
});
