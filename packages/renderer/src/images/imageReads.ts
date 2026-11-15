/** Which pictures a stretch of code asks the image cache for. */

let reading: Set<string>[] = [];

/** Count `src` as asked for by every {@link imageReadsDuring} running. */
export function noteImageRead(src: string): void {
  for (const set of reading) set.add(src);
}

/**
 * Run `fn`, and answer what it returns with the source of every picture it
 * asked `getImageBitmap` for, once each, in the order asked. Calls nest: an
 * inner call's reads are the outer's too.
 */
export function imageReadsDuring<T>(fn: () => T): { value: T; srcs: readonly string[] } {
  const set = new Set<string>();
  reading = [...reading, set];
  try {
    const value = fn();
    return { value, srcs: [...set] };
  } finally {
    reading = reading.filter((s) => s !== set);
  }
}
