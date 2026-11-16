/** Tickets for async work of which only the newest started may land. See {@link createLatest}. */
export interface Latest {
  /** Start a request. The returned check answers whether it is still the newest one started and not dropped. */
  take(): () => boolean;
  /** Retire every ticket taken so far: a newer answer arrived another way, or the owner is gone. */
  drop(): void;
}

/**
 * Guards an async answer against a later request: take a ticket as the request
 * leaves, and apply its answer only if the ticket still holds when it lands.
 *
 * ```ts
 * const picks = createLatest();
 * async function pick() {
 *   const mine = picks.take();
 *   const image = await decode(await chooseFile());
 *   if (mine()) show(image);
 * }
 * ```
 */
export function createLatest(): Latest {
  let newest = 0;
  return {
    take() {
      const mine = ++newest;
      return () => mine === newest;
    },
    drop() {
      newest += 1;
    },
  };
}
