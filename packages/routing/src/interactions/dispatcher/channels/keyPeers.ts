/** The keyboard channels on each surface, so a key the one holding the keys declines reaches the others there. */

/** Offer a keystroke to a channel with the keys held, as though its dispatcher held them. */
export type TakeKey = (e: KeyboardEvent) => void;

const PEERS = new WeakMap<Element, TakeKey[]>();

/** List `take` on `surface` until the returned release runs. */
export function joinSurface(surface: Element, take: TakeKey): () => void {
  const peers = PEERS.get(surface) ?? [];
  peers.push(take);
  PEERS.set(surface, peers);
  return () => {
    const i = peers.indexOf(take);
    if (i !== -1) peers.splice(i, 1);
    if (peers.length === 0) PEERS.delete(surface);
  };
}

/** Offer `e`, which `from` declined, to each other channel on `surface` in the order they joined, until one takes it. */
export function passOn(surface: Element, from: TakeKey, e: KeyboardEvent): void {
  for (const take of [...(PEERS.get(surface) ?? [])]) {
    if (e.defaultPrevented) return;
    if (take !== from) take(e);
  }
}
