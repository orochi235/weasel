/** The longest wait one `setTimeout` or `setInterval` keeps; past it, a timer fires at once. */
export const LONGEST_TIMER_MS = 2 ** 31 - 1;

/** Run `fn` once `ms` have passed, as `setTimeout` would, but waiting out an `ms` longer than one timer holds rather
 *  than firing at once, and never for an infinite `ms`. Answers what cancels it. */
export function after(ms: number, fn: () => void): () => void {
  if (ms === Infinity) return () => {};
  let timer: ReturnType<typeof setTimeout>;
  const wait = (left: number): void => {
    timer = setTimeout(() => (left > LONGEST_TIMER_MS ? wait(left - LONGEST_TIMER_MS) : fn()), Math.min(left, LONGEST_TIMER_MS));
  };
  wait(ms);
  return () => clearTimeout(timer);
}
