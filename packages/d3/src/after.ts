/** The longest wait one `setTimeout` keeps; past it, a timer fires at once. */
const LONGEST_TIMER = 2 ** 31 - 1;

/** Run `fn` once `ms` have passed, never for an infinite `ms`, and answer what cancels it. */
export function after(ms: number, fn: () => void): () => void {
  if (ms === Infinity) return () => {};
  let timer: ReturnType<typeof setTimeout>;
  const wait = (left: number): void => {
    timer = setTimeout(() => (left > LONGEST_TIMER ? wait(left - LONGEST_TIMER) : fn()), Math.min(left, LONGEST_TIMER));
  };
  wait(ms);
  return () => clearTimeout(timer);
}
