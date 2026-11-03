/**
 * Whether a derivation read something outside the scene that lands
 * asynchronously, such as glyph outlines. A derivation that read one while it
 * was loading is stale once it lands, with nothing in the scene changed. A
 * derivation that noted a read records {@link outsideGeneration} and
 * re-derives when it moves.
 *
 * The scene knows no source by name: each registers its own generation with
 * {@link addOutsideSource} (fonts do, in `fontReads.ts`).
 */

let noted = false;
const sources = new Set<() => number>();

/** Count `generation` into {@link outsideGeneration}. It must only ever grow,
 *  and move when what it guards lands. Returns the removal. */
export function addOutsideSource(generation: () => number): () => void {
  sources.add(generation);
  return () => sources.delete(generation);
}

/** Note that the derivation running now read an outside source. */
export function noteOutsideRead(): void {
  noted = true;
}

/** Run `fn`, reporting whether it — or anything it ran — noted an outside
 *  read. A read inside counts toward any enclosing `withOutsideReads` too. */
export function withOutsideReads<T>(fn: () => T): { value: T; outside: boolean } {
  const outer = noted;
  noted = false;
  try {
    const value = fn();
    return { value, outside: noted };
  } finally {
    noted = outer || noted;
  }
}

/** The generation an outside-reading derivation is checked against: the sum
 *  of every source's, so it moves when any of them does. */
export function outsideGeneration(): number {
  let sum = 0;
  for (const generation of sources) sum += generation();
  return sum;
}
